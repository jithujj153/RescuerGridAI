"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { GeoCoordinate } from "@/lib/types/incident";

interface InputPanelProps {
  onAnalyze: (formData: FormData) => void;
  isAnalyzing: boolean;
  onLocationDetected: (location: GeoCoordinate) => void;
  userLocation: GeoCoordinate | null;
}

export function InputPanel({
  onAnalyze,
  isAnalyzing,
  onLocationDetected,
  userLocation,
}: InputPanelProps) {
  const [text, setText] = useState("");
  const [newsUrl, setNewsUrl] = useState("");
  const [newsUrls, setNewsUrls] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-detect location on mount
  useEffect(() => {
    if (!userLocation && navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onLocationDetected({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationLoading(false);
        },
        () => {
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Image handling ─────────────────────────────────────
  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ─── URL handling ───────────────────────────────────────
  const addUrl = useCallback(() => {
    if (newsUrl && newsUrls.length < 5) {
      try {
        new URL(newsUrl);
        setNewsUrls((prev) => [...prev, newsUrl]);
        setNewsUrl("");
      } catch {
        alert("Please enter a valid URL");
      }
    }
  }, [newsUrl, newsUrls]);

  const removeUrl = useCallback((index: number) => {
    setNewsUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Voice recording ───────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // In a production app, we'd send audio to a Speech-to-Text API
        // For the demo, we'll use the transcript text field
        setAudioTranscript(
          "(Voice recording captured — use text field for transcript)"
        );
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone access is required for voice recording");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // ─── Submit ─────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!text && !imageFile && !audioTranscript) return;

    const formData = new FormData();
    if (text) formData.append("text", text);
    if (audioTranscript) formData.append("audioTranscript", audioTranscript);
    if (newsUrls.length > 0) formData.append("newsUrls", JSON.stringify(newsUrls));
    if (imageFile) formData.append("image", imageFile);
    if (userLocation) {
      formData.append("locationLat", String(userLocation.lat));
      formData.append("locationLng", String(userLocation.lng));
    }

    onAnalyze(formData);
  }, [text, imageFile, audioTranscript, newsUrls, userLocation, onAnalyze]);

  const hasInput = text || imageFile || audioTranscript;

  return (
    <>
      {/* Report text */}
      <div className="glass-card glass-card--elevated input-panel__section animate-fade-in">
        <div className="section-title">📝 Field Report</div>
        <label htmlFor="report-text" className="input-panel__label">
          Describe the situation
        </label>
        <textarea
          id="report-text"
          className="textarea"
          placeholder="E.g., Heavy smoke visible from the hillside near Oak Valley Road. Multiple cars stuck on the highway. People are evacuating on foot..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isAnalyzing}
          maxLength={5000}
          aria-describedby="text-hint"
        />
        <small id="text-hint" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {text.length}/5000 characters
        </small>
      </div>

      {/* Photo upload */}
      <div className="glass-card glass-card--elevated input-panel__section animate-fade-in" style={{ animationDelay: "50ms" }}>
        <div className="section-title">📷 Photo Evidence</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          style={{ display: "none" }}
          id="photo-upload"
          disabled={isAnalyzing}
          aria-label="Upload photo evidence"
        />

        {imagePreview ? (
          <div className="image-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Uploaded evidence" />
            <button
              className="image-preview__remove"
              onClick={removeImage}
              aria-label="Remove uploaded image"
              disabled={isAnalyzing}
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            className={`upload-zone ${isDragging ? "upload-zone--active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Click or drag to upload photo"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-zone__icon">📎</div>
            <div className="upload-zone__text">Drop photo or click to upload</div>
            <div className="upload-zone__hint">JPG, PNG, WebP — max 10MB</div>
          </div>
        )}
      </div>

      {/* Voice recording */}
      <div className="glass-card glass-card--elevated input-panel__section animate-fade-in" style={{ animationDelay: "100ms" }}>
        <div className="section-title">🎤 Voice Note</div>
        <div className="voice-recorder">
          <button
            className={`voice-recorder__btn ${isRecording ? "voice-recorder__btn--recording" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isAnalyzing}
            aria-label={isRecording ? "Stop recording" : "Start voice recording"}
          >
            {isRecording ? "⏹" : "🎙️"}
          </button>
          <div className="voice-recorder__status">
            {isRecording ? "Recording... tap to stop" : "Tap to record voice note"}
          </div>
        </div>
        {audioTranscript && (
          <textarea
            className="textarea"
            value={audioTranscript}
            onChange={(e) => setAudioTranscript(e.target.value)}
            placeholder="Voice transcript will appear here..."
            style={{ minHeight: "60px" }}
            aria-label="Audio transcript"
          />
        )}
      </div>

      {/* News URLs */}
      <div className="glass-card glass-card--elevated input-panel__section animate-fade-in" style={{ animationDelay: "150ms" }}>
        <div className="section-title">🔗 News Links</div>
        <div className="url-input-row">
          <input
            className="url-input"
            type="url"
            placeholder="https://news.example.com/article"
            value={newsUrl}
            onChange={(e) => setNewsUrl(e.target.value)}
            disabled={isAnalyzing}
            onKeyDown={(e) => e.key === "Enter" && addUrl()}
            aria-label="Add news URL"
          />
          <button
            className="btn btn--ghost btn--sm"
            onClick={addUrl}
            disabled={isAnalyzing || !newsUrl || newsUrls.length >= 5}
            aria-label="Add URL"
          >
            Add
          </button>
        </div>
        {newsUrls.map((url, i) => (
          <div key={i} className="url-input-row" style={{ fontSize: "0.8rem" }}>
            <span style={{
              flex: 1,
              color: "var(--accent-cyan)",
              fontFamily: "var(--font-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {url}
            </span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => removeUrl(i)}
              disabled={isAnalyzing}
              aria-label={`Remove URL ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Location */}
      <div className="glass-card glass-card--elevated input-panel__section animate-fade-in" style={{ animationDelay: "200ms" }}>
        <div className="section-title">📍 Location</div>
        {locationLoading ? (
          <div className="location-display">
            <span>Detecting location...</span>
          </div>
        ) : userLocation ? (
          <div className="location-display">
            <span>📍</span>
            <span>
              {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </span>
          </div>
        ) : (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (navigator.geolocation) {
                setLocationLoading(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    onLocationDetected({
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    });
                    setLocationLoading(false);
                  },
                  () => setLocationLoading(false)
                );
              }
            }}
            aria-label="Detect my location"
          >
            📍 Detect Location
          </button>
        )}
      </div>

      {/* Submit */}
      <div className="submit-area animate-fade-in" style={{ animationDelay: "250ms" }}>
        <button
          className="btn btn--primary btn--lg"
          onClick={handleSubmit}
          disabled={isAnalyzing || !hasInput}
          aria-label="Analyze crisis report"
          id="analyze-button"
        >
          {isAnalyzing ? (
            <>
              <span className="analyzing-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} aria-hidden="true" />
              Analyzing with Gemini...
            </>
          ) : (
            <>⚡ Analyze Crisis Report</>
          )}
        </button>
      </div>
    </>
  );
}
