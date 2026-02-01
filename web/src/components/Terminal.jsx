import React, { useEffect, useRef } from 'react';

const Terminal = ({ logs }) => {
    const bodyRef = useRef(null);

    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <section className="card terminal-card">
            <div className="terminal-header">
                <div className="terminal-dots">
                    <span className="dot red"></span>
                    <span className="dot yellow"></span>
                    <span className="dot green"></span>
                </div>
                <div className="terminal-title">system_logs.sh</div>
            </div>
            <div ref={bodyRef} className="terminal-body" id="terminal-body">
                {logs.length === 0 ? (
                    <div className="log-line info">Initialising NOC Monitor session...</div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className={`log-line ${log.type}`}>
                            <span className="time">[{log.timestamp}]</span>
                            <span className="message">{log.message}</span>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
};

export default Terminal;
