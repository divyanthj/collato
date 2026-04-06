"use client";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
export const VoiceInputButton = forwardRef(function VoiceInputButton({ onTranscript, onAudioData, onRecordingChange }, ref) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const animationFrameRef = useRef(null);
    const loopAudioData = () => {
        if (!analyserRef.current || !dataArrayRef.current) {
            return;
        }
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        onAudioData?.(new Uint8Array(dataArrayRef.current));
        animationFrameRef.current = requestAnimationFrame(loopAudioData);
    };
    const cleanupRecordingResources = useCallback(async () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        onAudioData?.(null);
        if (audioContextRef.current) {
            await audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaRecorderRef.current?.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
    }, [onAudioData]);
    const transcribeAudio = async () => {
        setIsRecording(false);
        setIsTranscribing(true);
        await cleanupRecordingResources();
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        try {
            const response = await fetch("/api/transcribe", {
                method: "POST",
                body: formData
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error ?? "Transcription failed");
            }
            onTranscript(result.text);
        }
        catch (transcriptionError) {
            setError(transcriptionError instanceof Error ? transcriptionError.message : "Transcription failed");
        }
        finally {
            setIsTranscribing(false);
        }
    };
    const handleStartRecording = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            mediaRecorder.onstop = () => {
                void transcribeAudio();
            };
            mediaRecorder.start();
            setIsRecording(true);
            const audioContext = new window.AudioContext();
            audioContextRef.current = audioContext;
            if (audioContext.state === "suspended") {
                await audioContext.resume();
            }
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyserRef.current = analyser;
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            loopAudioData();
        }
        catch (recordingError) {
            setError("Microphone access was denied or unavailable.");
            console.error(recordingError);
        }
    };
    const handleStopRecording = () => {
        mediaRecorderRef.current?.stop();
    };
    useEffect(() => {
        onRecordingChange?.(isRecording);
    }, [isRecording, onRecordingChange]);
    useEffect(() => {
        return () => {
            void cleanupRecordingResources();
        };
    }, [cleanupRecordingResources]);
    return (<div className="flex items-center gap-3">
      {!isRecording ? (<button ref={ref} type="button" className="btn btn-circle border border-base-300 bg-base-100 text-neutral shadow-sm" onClick={handleStartRecording} disabled={isTranscribing} title="Tap to speak. Only the transcript is saved.">
          {isTranscribing ? (<span className="loading loading-spinner loading-xs"/>) : (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6.75a3 3 0 0 0 3 3Z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5v.75a7.5 7.5 0 0 1-15 0v-.75"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75V21m-3 0h6"/>
            </svg>)}
        </button>) : (<button type="button" className="btn btn-circle btn-neutral" onClick={handleStopRecording} title="Stop recording">
          <span className="block h-3 w-3 rounded-sm bg-white"/>
        </button>)}

      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>);
});
