import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Play,
  Volume2,
  MessageSquare,
  Activity,
  ShieldCheck,
  Quote,
  MoreVertical,
  Pause,
} from "lucide-react";

const StatusBadge = ({ status, variant = "large" }) => {
  const styles = {
    Match: "bg-green-500 text-white border-green-500",
    Mismatch: "bg-red-500 text-white border-red-500",
    Inconclusive: "bg-gray-400 text-white border-gray-400",
    Clean: "bg-green-500 text-white border-green-500",
    Flagged: "bg-red-500 text-white border-red-500 font-black px-4",
  };

  const sizeClasses =
    variant === "large"
      ? "px-4 py-1 text-[11px] font-black tracking-[0.1em]"
      : "px-3 py-0.5 text-[9px] font-black tracking-[0.05em]";

  return (
    <span
      className={`${sizeClasses} rounded-full uppercase border shadow-sm ${styles[status] || styles.Inconclusive}`}
    >
      {status}
    </span>
  );
};

const AuditRow = ({
  label,
  submitted,
  questionTime,
  detected,
  detectedTime,
  status,
  isRegexFallback,
  onPlay,
}) => {
  const Icon = status === "Match" ? CheckCircle : AlertCircle;
  const iconBaseColor =
    status === "Match"
      ? "text-green-500 bg-green-50"
      : "text-orange-400 bg-orange-50";

  return (
    <div className="grid grid-cols-[1.5fr_1.5fr_1.5fr_2fr_1fr] items-center py-6 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
      {/* Label & Icon */}
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${iconBaseColor}`}>
          <Icon className="w-5 h-5 shrink-0" />
        </div>
        <span className="text-[13px] font-black text-black uppercase tracking-tight">
          {label}
        </span>
      </div>

      {/* Submitted Value */}
      <div>
        <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">
          Submitted
        </p>
        <p className="text-sm font-black text-black leading-none">
          {submitted || "-"}
        </p>
      </div>

      {/* Question Asked */}
      <div>
        <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">
          Question Asked
        </p>
        <div className="flex items-center gap-2">
          <span
            className="bg-black text-white text-[11px] font-black px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() =>
              questionTime !== "Not Detected" && onPlay(questionTime)
            }
          >
            {questionTime || "Not Detected"}
          </span>
          {questionTime !== "Not Detected" && (
            <Play
              className="w-3 h-3 text-black fill-current cursor-pointer hover:scale-110 transition-transform"
              onClick={() => onPlay(questionTime)}
            />
          )}
        </div>
      </div>

      {/* AI Detected */}
      <div>
        <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">
          AI Detected
        </p>
        <p className="text-sm font-black text-black leading-tight">
          {detected || "None"}
        </p>
        {detectedTime && (
          <p className="text-[10px] italic font-bold text-gray-400">
            @{detectedTime}
          </p>
        )}
        {isRegexFallback && (
          <div className="mt-2">
            <span className="bg-orange-100 text-orange-600 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
              REGEX USED
            </span>
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex justify-end">
        <StatusBadge status={status} />
      </div>
    </div>
  );
};

const ClipCard = ({ label, time, endTime, isAvailable = true, audioUrl }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [volume, setVolume] = React.useState(1); // 0 to 1
  const [showVolumeSlider, setShowVolumeSlider] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = React.useState(false);
  const audioRef = React.useRef(null);
  const intervalRef = React.useRef(null);

  const parseTime = (timeStr) => {
    if (!timeStr || timeStr === "Not Detected") return 0;
    const parts = timeStr.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  };

  const startTimeInSec = React.useMemo(() => parseTime(time), [time]);
  const endTimeInSec = React.useMemo(() => parseTime(endTime), [endTime]);

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const snippetDuration = React.useMemo(() => {
    if (endTimeInSec && startTimeInSec && endTimeInSec > startTimeInSec) {
      return endTimeInSec - startTimeInSec;
    }
    return 4; // Default fallback
  }, [startTimeInSec, endTimeInSec]);

  const changeSpeed = (speed, e) => {
    e.stopPropagation();
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!isAvailable || !audioUrl || time === "Not Detected") return;

    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      const playAudio = () => {
        const adjustedStart = Math.max(0, startTimeInSec - 1);
        audioRef.current.currentTime = adjustedStart + currentTime;
        audioRef.current.volume = volume;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current
          .play()
          .catch((e) => console.error("Playback failed", e));
        setIsPlaying(true);

        intervalRef.current = setInterval(() => {
          if (!audioRef.current) return;
          const elapsed = audioRef.current.currentTime - adjustedStart;
          if (elapsed >= snippetDuration || audioRef.current.ended) {
            audioRef.current.pause();
            setIsPlaying(false);
            setCurrentTime(0);
            clearInterval(intervalRef.current);
          } else {
            setCurrentTime(elapsed);
          }
        }, 100);
      };

      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        // Need to wait for metadata before seeking
        audioRef.current.addEventListener("loadedmetadata", playAudio, {
          once: true,
        });
        // Failsafe if already loaded
        if (audioRef.current.readyState >= 1) {
          audioRef.current.removeEventListener("loadedmetadata", playAudio);
          playAudio();
        }
      } else {
        playAudio();
      }
    }
  };

  const toggleVolume = (e) => {
    e.stopPropagation();
    const nextVolume = volume === 1 ? 0.5 : volume === 0.5 ? 0 : 1;
    setVolume(nextVolume);
    if (audioRef.current) audioRef.current.volume = nextVolume;
  };

  const handleVolumeChange = (e) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) audioRef.current.volume = newVolume;
  };

  return (
    <div
      className={`rounded-2xl p-4 border transition-all duration-300 relative ${
        isAvailable
          ? "bg-white border-gray-100 hover:border-black"
          : "bg-gray-50/50 border-gray-100 opacity-60"
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className={`w-4 h-4 ${isAvailable ? "text-black" : "text-gray-300"}`}
          />
          <h4 className="text-[11px] font-black text-black uppercase tracking-tight">
            {label}
          </h4>
        </div>
        <span className="text-[9px] font-black text-gray-400 tabular-nums uppercase">
          Ref @{time || "None"}
        </span>
      </div>

      {isAvailable ? (
        <div
          className="bg-gray-50 rounded-full py-1.5 px-4 flex items-center gap-4 w-full group cursor-pointer"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 text-black fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 text-black fill-current" />
          )}

          <span className="text-[11px] font-bold text-gray-600 tabular-nums min-w-[65px]">
            0:
            {currentTime < 10
              ? `0${Math.floor(currentTime)}`
              : Math.floor(currentTime)}{" "}
            / 0:0{snippetDuration}
          </span>

          <div className="flex-1 h-1 bg-gray-300 rounded-full relative">
            <div
              className="absolute left-0 top-0 bottom-0 bg-black rounded-full transition-all duration-100"
              style={{ width: `${(currentTime / snippetDuration) * 100}%` }}
            />
          </div>

          <div
            className="flex items-center gap-2 relative group-controls"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            {volume === 0 ? (
              <Activity
                className="w-3.5 h-3.5 text-red-500 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setVolume(1);
                  if (audioRef.current) audioRef.current.volume = 1;
                }}
                title="Muted"
              />
            ) : (
              <Volume2
                className={`w-3.5 h-3.5 text-black cursor-pointer transition-opacity ${volume < 0.5 ? "opacity-40" : "opacity-100"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setVolume(0);
                  if (audioRef.current) audioRef.current.volume = 0;
                }}
                title="Click to Mute"
              />
            )}

            {showVolumeSlider && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 60, opacity: 1 }}
                className="overflow-hidden flex items-center h-4"
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-12 h-1 accent-black cursor-pointer"
                />
              </motion.div>
            )}

            <div className="relative ml-1">
              <MoreVertical
                className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-black"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu(!showSpeedMenu);
                }}
              />
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-100 rounded-xl shadow-xl p-2 z-50 min-w-[80px]">
                  {[0.5, 1, 1.5, 2].map((speed) => (
                    <div
                      key={speed}
                      className={`text-[10px] font-black p-2 rounded-lg cursor-pointer hover:bg-gray-50 mb-1 last:mb-0 ${playbackRate === speed ? "bg-black text-white" : "text-black"}`}
                      onClick={(e) => changeSpeed(speed, e)}
                    >
                      {speed}x
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-gray-200 rounded-xl py-2 text-center">
          <p className="text-[10px] font-bold text-gray-400 italic uppercase tracking-widest">
            Not Detected
          </p>
        </div>
      )}
    </div>
  );
};

const AuditResult = ({
  result,
  formAge,
  formName,
  formProfession,
  formEducation,
  formLocation,
  formMobile,
  audioFile,
}) => {
  const [audioUrl, setAudioUrl] = React.useState(null);

  React.useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (result?.audit_result?.audio_url) {
      // Fallback to backend audio URL if local file is missing
      setAudioUrl(result.audit_result.audio_url);
    }
  }, [audioFile, result]);

  if (!result) return null;

  const { audit_result, transcript } = result;
  const za = audit_result?.z_audit;
  const {
    detected_values,
    statuses,
    timestamps,
    sentiment,
    status: overallStatus,
  } = audit_result;

  const gemini = timestamps.gemini || {};

  const playSnippet = (timeStr) => {
    if (!audioUrl || timeStr === "Not Detected") return;

    // Convert H:M:S string to seconds
    const parts = timeStr.split(":").map(Number);
    let seconds = 0;
    if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else {
      seconds = parts[0];
    }

    const audio = new Audio(audioUrl);
    audio.currentTime = seconds;
    audio.play();

    // Stop after 2 seconds
    setTimeout(() => {
      audio.pause();
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full mx-auto text-left mb-20 flex flex-col gap-10"
    >
      {/* Z-AUDIT COMPONENT */}
      {za && (
        <div className="bg-white rounded-[32px] shadow-[0_20px_80px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">
          <div className="bg-black px-10 py-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-white/10 to-transparent rounded-full -mr-64 -mt-64" />
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <div className="flex items-center bg-white rounded-full p-1 pl-1 pr-4 gap-2 mb-4 w-fit shadow-2xl">
                   <span className={`px-4 py-1 text-[11px] font-black tracking-[0.1em] rounded-full uppercase border shadow-sm ${za.status === 'Clean' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                      {za.status}
                   </span>
                  <span className="text-[9px] font-black text-black italic tracking-widest uppercase opacity-70">
                    Z-AUDIT ENGINE
                  </span>
                </div>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-1">
                  Z-Audit Forensic Analysis
                </h2>
                <p className="text-white/60 text-sm font-medium tracking-wide">
                  UID: {za.uid}
                </p>
              </div>
              <div className="text-right">
                <div className="text-6xl font-black text-white leading-none">
                  {za.final_score}
                  <span className="text-2xl text-white/30 ml-1">/10</span>
                </div>
                <div className="text-white/60 text-[10px] uppercase tracking-widest font-black mt-2">
                  Final Audit Score
                </div>
              </div>
            </div>
          </div>

          {/* Top Info Cards */}
          <div className="p-10 pb-0 grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Payment Decision
              </p>
              <h3
                className={`text-4xl font-black uppercase tracking-tighter ${za.payment_decision === "Full Payment" ? "text-green-600" : za.payment_decision === "Partial Payment" ? "text-orange-500" : "text-red-500"}`}
              >
                {za.payment_decision}
              </h3>
            </div>
            <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Issues Detected
              </p>
              {za.issues_detected && za.issues_detected.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {za.issues_detected.map((i, idx) => (
                    <span
                      key={idx}
                      className="bg-red-50 text-red-600 font-black px-4 py-1.5 rounded-lg text-[11px] uppercase tracking-wide border border-red-100"
                    >
                      {i}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="bg-green-50 text-green-700 font-bold px-3 py-1 rounded-lg text-xs uppercase">
                  No Issues Detected
                </span>
              )}
            </div>
          </div>

          {/* Evidence Tracker Section */}
          <div className="px-10 pb-10">
            <h4 className="text-sm font-black text-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" /> Evidence Tracker
            </h4>
            
            {za.evidence && za.evidence.length > 0 ? (
              <ul className="space-y-3">
                {za.evidence.map((ev, idx) => (
                  <li
                    key={idx}
                    className="bg-red-50/30 border border-red-100 p-5 rounded-2xl flex flex-col gap-1 hover:bg-red-50/50 transition-colors"
                  >
                    <span className="text-[11px] font-black text-red-600 uppercase tracking-widest mb-0.5">
                      {ev.issue}
                    </span>
                    <p className="text-red-900/80 text-sm font-bold leading-relaxed">
                      {ev.detail}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-8 text-center border border-dashed border-gray-200">
                <p className="text-gray-400 text-[11px] font-black uppercase tracking-widest">No detailed evidence reports generated for this audit.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Report Card (Standard Data Point Audit) */}
      <div className="w-full bg-white rounded-[32px] shadow-[0_20px_80px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">
        {/* BLACK HEADER */}
        <div className="bg-black px-10 py-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-white/10 to-transparent rounded-full -mr-64 -mt-64" />
          <div className="relative z-10">
            <div className="flex items-center bg-white rounded-full p-1 pl-1 pr-4 gap-2 mb-3 w-fit shadow-2xl">
              <StatusBadge status={overallStatus} variant="small" />
              <span className="text-[9px] font-black text-black italic tracking-widest uppercase opacity-70">
                System Verified
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                  Security Audit Report
                </h2>
                {audit_result.is_emergency && (
                  <div className="flex items-center">
                    <span className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded uppercase tracking-[0.15em] animate-pulse">
                      REGEX USED
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl p-3 shadow-xl">
                <AlertCircle className="w-8 h-8 text-black" strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>

        {/* AUDIT BODY */}
        <div className="px-10 py-4">
          <AuditRow
            label="Name"
            submitted={formName}
            questionTime={timestamps.questions.name}
            detected={detected_values.name}
            detectedTime={timestamps.detected.name}
            status={statuses.name}
            isRegexFallback={audit_result.is_regex_fallback?.name}
            onPlay={playSnippet}
          />
          <AuditRow
            label="Age"
            submitted={formAge}
            questionTime={timestamps.questions.age}
            detected={detected_values.age}
            detectedTime={timestamps.detected.age}
            status={statuses.age}
            isRegexFallback={audit_result.is_regex_fallback?.age}
            onPlay={playSnippet}
          />
          <AuditRow
            label="Profession"
            submitted={formProfession}
            questionTime={timestamps.questions.profession}
            detected={detected_values.profession}
            detectedTime={timestamps.detected.profession}
            status={statuses.profession}
            isRegexFallback={audit_result.is_regex_fallback?.profession}
            onPlay={playSnippet}
          />
          <AuditRow
            label="Education"
            submitted={formEducation}
            questionTime={timestamps.questions.education}
            detected={detected_values.education}
            detectedTime={timestamps.detected.education}
            status={statuses.education}
            isRegexFallback={audit_result.is_regex_fallback?.education}
            onPlay={playSnippet}
          />
          <AuditRow
            label="Location"
            submitted={formLocation}
            questionTime={timestamps.questions.location}
            detected={detected_values.location}
            detectedTime={timestamps.detected.location}
            status={statuses.location}
            isRegexFallback={audit_result.is_regex_fallback?.location}
            onPlay={playSnippet}
          />
          <AuditRow
            label="Mobile"
            submitted={formMobile}
            questionTime={timestamps.questions.mobile}
            detected={detected_values.mobile}
            detectedTime={timestamps.detected.mobile}
            status={statuses.mobile}
            isRegexFallback={audit_result.is_regex_fallback?.mobile}
            onPlay={playSnippet}
          />
        </div>

        {/* TRANSCRIPT SECTION */}
        <div className="bg-gray-50/50 border-t border-gray-100 p-8 pt-12 relative">
          <span className="absolute top-6 left-10 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">
            Verification Transcript
          </span>
            <div className="bg-white border border-gray-100 rounded-3xl p-6 relative flex gap-6 max-h-[400px] overflow-y-auto">
              <Quote className="w-12 h-12 text-gray-50 shrink-0 fill-current absolute -top-4 -left-2" />
              <div className="text-sm font-bold text-gray-600 italic leading-loose relative z-10 whitespace-pre-wrap w-full">
                {transcript.split('\n').map((line, idx) => {
                  if (line.startsWith('[') && line.includes(']:')) {
                    const [speaker, ...rest] = line.split(']:');
                    return (
                      <div key={idx} className="mb-2">
                        <span className="text-black font-black uppercase text-[10px] tracking-widest mr-2 bg-gray-100 px-2 py-0.5 rounded">
                          {speaker.replace('[', '')}
                        </span>
                        <span>{rest.join(']:')}</span>
                      </div>
                    );
                  }
                  return <p key={idx}>{line}</p>;
                })}
              </div>
            </div>

          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gray-100 p-4 rounded-2xl">
                <Volume2 className="text-gray-400 w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                  Audit Audio
                </p>
                <p className="text-sm font-black text-black uppercase tracking-tight">
                  Full Recording
                </p>
              </div>
            </div>

            {/* FUNCTIONAL FULL AUDIO PLAYER */}
            {audioUrl ? (
              <div className="flex-1 ml-16">
                <audio
                  src={audioUrl}
                  controls
                  className="w-full h-10 accent-black filter grayscale opacity-80 hover:opacity-100 transition-opacity"
                />
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-full py-3 px-6 flex items-center gap-6 shadow-sm flex-1 ml-16">
                <Play className="w-4 h-4 text-gray-300 fill-current" />
                <div className="h-1 bg-gray-100 rounded-full flex-1 relative" />
                <span className="text-[11px] font-black text-gray-400 tabular-nums">
                  0:00 / 0:00
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TONE & SENTIMENT AUDIT */}
      <div className="mb-8">
        <div className="bg-black rounded-[32px] p-8 border border-black shadow-xl">
          <div className="mb-6">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">
              Psychological Analysis
            </p>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">
              Tone & Sentiment Audit
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-[#111] border border-white/5 rounded-[24px] p-8 text-center flex flex-col justify-center items-center">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">
                Vocal Emotion
              </p>
              <span className="bg-white text-black font-black px-6 py-2 rounded-xl text-lg uppercase shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                {sentiment.emotion}
              </span>
            </div>
            <div className="bg-[#111] border border-white/5 rounded-[24px] p-8 text-center flex flex-col justify-center items-center">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">
                Speech Meaning
              </p>
              <span className="border-2 border-white text-white font-black px-8 py-2 rounded-xl text-lg uppercase">
                {sentiment.meaning}
              </span>
            </div>
            <div className="bg-white rounded-[24px] p-8 text-center flex flex-col justify-center items-center shadow-2xl">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                Interpretation
              </p>
              <h4 className="text-xl font-black text-black uppercase leading-tight italic tracking-tighter">
                "{sentiment.interpretation}"
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* AUDIT AUDIO CLIPS */}
      <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
        <div className="flex justify-between items-end mb-6">
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">
              Question Verification
            </p>
            <h3 className="text-2xl font-black text-black uppercase tracking-tighter">
              Audit Audio Clips
            </h3>
          </div>
          <div className="flex gap-3">
            <span className="bg-gray-100 text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-2 uppercase tracking-wide">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" /> Surveyor:
              Speaker_1
            </span>
            <span className="bg-gray-100 text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-2 uppercase tracking-wide">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />{" "}
              Responder: Speaker_2
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <ClipCard
            label="Name"
            time={gemini.name?.start || timestamps.questions.name}
            endTime={gemini.name?.end}
            audioUrl={audioUrl}
            isAvailable={!!(gemini.name?.start || timestamps.questions.name !== "Not Detected")}
          />
          <ClipCard
            label="Age"
            time={gemini.age?.start || timestamps.questions.age}
            endTime={gemini.age?.end}
            audioUrl={audioUrl}
            isAvailable={!!(gemini.age?.start || timestamps.questions.age !== "Not Detected")}
          />
          <ClipCard
            label="Location"
            time={gemini.location?.start || timestamps.questions.location}
            endTime={gemini.location?.end}
            audioUrl={audioUrl}
            isAvailable={!!(gemini.location?.start || timestamps.questions.location !== "Not Detected")}
          />
          <ClipCard
            label="Profession"
            time={gemini.profession?.start || timestamps.questions.profession}
            endTime={gemini.profession?.end}
            audioUrl={audioUrl}
            isAvailable={!!(gemini.profession?.start || timestamps.questions.profession !== "Not Detected")}
          />
          <ClipCard
            label="Education"
            time={gemini.education?.start || timestamps.questions.education}
            endTime={gemini.education?.end}
            audioUrl={audioUrl}
            isAvailable={!!(gemini.education?.start || timestamps.questions.education !== "Not Detected")}
          />
          <ClipCard
            label="Mobile"
            time={gemini.mobile?.start || timestamps.questions.mobile}
            endTime={gemini.mobile?.end}
            audioUrl={audioUrl}
            isAvailable={!!(gemini.mobile?.start || timestamps.questions.mobile !== "Not Detected")}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default AuditResult;
