import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let handLandmarker = undefined;
let createPromise = null;
let lastWristX = 0;
let lastWristY = 0;
let isThrowing = false;
let cooldown = 0;
const HISTORY_LENGTH = 5;
let positionHistory = [];

let onThrow = null;
let onLandmarks = null;

export function setOnThrow(fn) { onThrow = fn; }
export function setOnLandmarks(fn) { onLandmarks = fn; }
export function isHandLandmarkerReady() { return !!handLandmarker; }

export const createHandLandmarker = async () => {
    // Return existing instance if already created
    if (handLandmarker) return handLandmarker;

    // If creation is already in progress, await the same promise
    if (createPromise) return createPromise;

    createPromise = (async () => {
        const visionGen = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        // If another caller managed to set handLandmarker while awaiting, return it
        if (handLandmarker) {
            createPromise = null;
            return handLandmarker;
        }

        handLandmarker = await HandLandmarker.createFromOptions(visionGen, {
            baseOptions: {
                modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
        });

        createPromise = null;
        return handLandmarker;
    })();

    return createPromise;
};

export async function destroyHandLandmarker() {
    // Wait for any ongoing creation to finish so we can cleanly close it
    if (createPromise) {
        try { await createPromise; } catch (e) { /* ignore */ }
    }

    if (handLandmarker) {
        // close() is used by mediapipe tasks-vision objects; call if available
        try {
            if (typeof handLandmarker.close === "function") {
                handLandmarker.close();
            } else if (typeof handLandmarker.dispose === "function") {
                handLandmarker.dispose();
            }
        } catch (e) {
            // swallow errors to avoid crashing teardown
            console.warn("Error closing handLandmarker:", e);
        }
    }

    handLandmarker = undefined;
    createPromise = null;

    // Reset tracking state
    lastWristX = 0;
    lastWristY = 0;
    isThrowing = false;
    cooldown = 0;
    positionHistory = [];
    onThrow = null;
    onLandmarks = null;
}

export function detectThrow(videoInput) {
    if (!handLandmarker) return;

    const result = handLandmarker.detectForVideo(videoInput, Date.now());
    if (!result || !result.landmarks || result.landmarks.length === 0) {
        if (onLandmarks) onLandmarks(null);
        return;
    }

    const lm = result.landmarks[0];
    const rawWrist = lm[0];
    const indexMcp = lm[5];
    const pinkyMcp = lm[17];
    const knuckleMid = { x: (indexMcp.x + pinkyMcp.x) / 2, y: (indexMcp.y + pinkyMcp.y) / 2 };
    const elbow = {
        x: rawWrist.x + (rawWrist.x - knuckleMid.x) * 0.6,
        y: rawWrist.y + (rawWrist.y - knuckleMid.y) * 0.6,
    };

    // Update position history and compute averaged wrist for smoothing
    positionHistory.push({ x: rawWrist.x, y: rawWrist.y });
    if (positionHistory.length > HISTORY_LENGTH) positionHistory.shift();
    let avgX = 0, avgY = 0;
    for (let pos of positionHistory) {
        avgX += pos.x;
        avgY += pos.y;
    }
    const wrist = {
        x: avgX / positionHistory.length,
        y: avgY / positionHistory.length
    };

    const vx = wrist.x - lastWristX;
    const vy = wrist.y - lastWristY;
    const speed = Math.hypot(vx, vy);

    // Only throw if moving downward (vy > 0) and speed threshold met
    if (speed > 0.05 && vy > 0 && !isThrowing && cooldown <= 0) {
        cooldown = 10;
        const power = speed * 400;
        if (onThrow) onThrow(power, wrist);
        isThrowing = true;
    }
    if (speed < 0.02) {
        isThrowing = false;
    }
    cooldown--;

    lastWristX = wrist.x;
    lastWristY = wrist.y;

    if (onLandmarks) {
        onLandmarks({
            wrist,
            elbow
        });
    }
}