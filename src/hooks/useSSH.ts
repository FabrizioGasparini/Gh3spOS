import { useRef } from "react";

export const useSSH = (onOutput: (data: string) => void, onStatus: (status: string) => void) => {
    const socketRef = useRef<WebSocket | null>(null);

    const connect = ({ host, port, username, password }: { host: string; port?: number; username: string; password: string }) => {
        socketRef.current = new WebSocket("ws://localhost:3001");

        socketRef.current.onopen = () => {
            socketRef.current?.send(
                JSON.stringify({
                    type: "connect",
                    host,
                    port,
                    username,
                    password,
                })
            );
        };

        socketRef.current.onmessage = (msg) => {
            try {
                const data = JSON.parse(msg.data);
                if (data.type === "output") onOutput(data.data);
                else if (data.type === "status") onStatus(data.message);
            } catch (err) {
                // Se non è JSON, probabilmente è output raw del terminale: lo stampiamo lo stesso
                console.error(err);
                onOutput(msg.data);
            }
        };
    };

    const sendCommand = (input: string) => {
        socketRef.current?.send(JSON.stringify({ type: "input", data: input }));
    };

    return { connect, sendCommand };
};
