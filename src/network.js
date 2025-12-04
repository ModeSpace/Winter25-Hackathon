
let peer = null;
let conn = null;
let onDataCallback = null;
let onDisconnectCallback = null;
let sendInterval = 50;

export const Network = {
    // 1. Initialize as Host
    hostGame: (onReady) => {
        const customId = Math.floor(10000 + Math.random() * 90000).toString(); // Generate 5-digit ID
        peer = new Peer(customId);

        peer.on('open', (id) => {
            if (onReady) onReady(id);
        });

        peer.on('connection', (connection) => {
            conn = connection;
            setupConnection();
        });
    },

    joinGame: (hostId, onConnected) => {
        peer = new Peer(); // We still need an ID to exist

        peer.on('open', () => {
            // Connect to the host
            conn = peer.connect(hostId);

            conn.on('open', () => {
                setupConnection();
                if (onConnected) onConnected();
            });
        });
    },

    // 3. Send data to the other person
    send: (data) => {
        if (conn && conn.open) {
            conn.send(data);
        }
    },

    // 4. Listen for data
    setDataHandler: (callback) => {
        onDataCallback = callback;
    },

    isConnected: () => {
        return conn && conn.open;
    },
    setDisconnectHandler: (cb) => { onDisconnectCallback = cb; }
};

function setupConnection() {
    conn.on('data', (data) => {
        if (onDataCallback) onDataCallback(data);
    });

    conn.on('close', () => {
        console.log("Connection lost");
        if (onDisconnectCallback) onDisconnectCallback(); // <-- call handler
    });
}