import { useRef } from "react";

export const useSSH = (onOutput: (data: string) => void, onStatus: (status: string) => void) => {
    const socketRef = useRef<WebSocket | null>(null);

    const connect = ({ host, port, username, password }: { host: string; port?: number; username: string; password: string }) => {
        socketRef.current = new WebSocket("ws://localhost:8080");

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
            const data = JSON.parse(msg.data);
            if (data.type === "output") onOutput(data.data);
            if (data.type === "status") onStatus(data.message);
        };
    };

    const sendCommand = (input: string) => {
        socketRef.current?.send(JSON.stringify({ type: "input", data: input }));
    };

    return { connect, sendCommand };
};
