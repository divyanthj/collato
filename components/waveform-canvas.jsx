"use client";
import { useEffect, useRef } from "react";
export function WaveformCanvas({ audioData, className = "", strokeColor = "#20594b" }) {
    const canvasRef = useRef(null);
    useEffect(() => {
        if (!audioData || !canvasRef.current) {
            return;
        }
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) {
            return;
        }
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.lineWidth = 2;
        context.strokeStyle = strokeColor;
        context.beginPath();
        const skipFactor = 48;
        const smoothingWindow = 4;
        const amplitudeFactor = 2.2;
        const steps = Math.max(1, Math.floor(audioData.length / skipFactor));
        const sliceWidth = width / steps;
        let x = 0;
        const points = [];
        for (let index = 0; index < audioData.length; index += skipFactor) {
            let sum = 0;
            let count = 0;
            for (let inner = index; inner < index + smoothingWindow && inner < audioData.length; inner += 1) {
                sum += audioData[inner];
                count += 1;
            }
            const average = sum / Math.max(1, count);
            const centered = ((average - 128) / 128) * amplitudeFactor;
            const y = (centered * height) / 2 + height / 2;
            points.push({ x, y });
            x += sliceWidth;
        }
        if (points.length > 0) {
            context.moveTo(points[0].x, points[0].y);
        }
        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1];
            const current = points[index];
            const midX = (previous.x + current.x) / 2;
            const midY = (previous.y + current.y) / 2;
            context.quadraticCurveTo(previous.x, previous.y, midX, midY);
        }
        const lastPoint = points[points.length - 1];
        if (lastPoint) {
            context.lineTo(lastPoint.x, lastPoint.y);
        }
        context.stroke();
    }, [audioData, strokeColor]);
    return <canvas ref={canvasRef} className={`pointer-events-none ${className}`}/>;
}
