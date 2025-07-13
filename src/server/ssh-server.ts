import { Client } from "ssh2";
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
    let ssh: Client | null = null;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg.toString());

        if (data.type === "connect") {
            const { host, username, password, port } = data;

            ssh = new Client();
            ssh.on("ready", () => {
                ws.send(JSON.stringify({ type: "status", message: "Connected to SSH" }));
                ssh?.shell((err, stream) => {
                    if (err) return ws.send(JSON.stringify({ type: "error", message: err.message }));

                    stream.on("data", (chunk) => {
                        ws.send(JSON.stringify({ type: "output", data: chunk.toString() }));
                    });

                    ws.on("message", (inputMsg) => {
                        const inputData = JSON.parse(inputMsg.toString());
                        if (inputData.type === "input") {
                            stream.write(inputData.data);
                        }
                    });
                });
            }).connect({
                host,
                port: port || 22,
                username,
                password,
            });
        }
    });

    ws.on("close", () => {
        ssh?.end();
    });
});

console.log("SSH WebSocket server listening on ws://localhost:8080");
