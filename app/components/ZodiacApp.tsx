"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  createDuelShareCard,
  createShareCard,
} from "@/src/client/share-card";
import {
  getAnonymousDeviceId,
  trackAnonymousEvent,
} from "@/src/client/telemetry";
import {
  buildDuelSharePath,
  createDuelRound,
  getDuelDifference,
  matchForDuelChoice,
  type DuelRound,
  type SharedDuelRound,
} from "@/src/lib/duel";
import {
  LOCAL_COMPANION_KEY,
  confirmLocalPersona,
  parseLocalCompanionState,
  saveLocalMode,
  saveLocalSession,
  type LocalChatMessage,
  type LocalCompanionState,
} from "@/src/lib/local-state";
import {
  TASK_MODES,
  getTaskMode,
  type TaskModeId,
} from "@/src/lib/modes";
import { PERSONAS, getPersona } from "@/src/lib/personas";
import { compileSystemPrompt } from "@/src/lib/prompt";
import { QUIZ_QUESTIONS, recommendPersonas } from "@/src/lib/quiz";
import {
  AXIS_KEYS,
  AXIS_LABELS,
  type ZodiacId,
  type ZodiacPersona,
} from "@/src/lib/zodiac";

type AppView = "home" | "quiz" | "duel" | "result" | "chat" | "explore";

interface ZodiacAppProps {
  initialView: "home" | "explore";
  sharedPersonaId?: string;
  sharedDuel?: SharedDuelRound;
}

type ChatMessage = LocalChatMessage;

const ELEMENT_LABELS = {
  fire: "火象",
  earth: "土象",
  air: "风象",
  water: "水象",
};

const QUICK_PROMPTS = [
  "帮我安排今天最重要的三件事",
  "我有点焦虑，陪我理一理",
  "给这个普通点子加点新意",
];

function ModeSelector({
  persona,
  activeModeId,
  onSelect,
}: {
  persona: ZodiacPersona;
  activeModeId: TaskModeId | null;
  onSelect: (modeId: TaskModeId) => void;
}) {
  useEffect(() => {
    trackAnonymousEvent("mode_selector_view", { personaId: persona.id });
  }, [persona.id]);

  return (
    <section className="mode-selector" aria-label="选择这次的任务模式">
      <div className="mode-selector-copy">
        <small>这次想让{persona.nameZh}怎么帮？</small>
        <strong>人格决定怎么说，模式决定这次怎么做。</strong>
      </div>
      <div className="mode-options">
        {TASK_MODES.map((mode) => (
          <button
            key={mode.id}
            className={activeModeId === mode.id ? "is-active" : ""}
            onClick={() => onSelect(mode.id)}
            aria-pressed={activeModeId === mode.id}
          >
            <span aria-hidden="true">{mode.icon}</span>
            <span><strong>{mode.name}</strong><small>{mode.tagline}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function personaStyle(persona: ZodiacPersona): CSSProperties {
  return {
    "--persona-primary": persona.visual.primary,
    "--persona-secondary": persona.visual.secondary,
  } as CSSProperties;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function browserTimestamp(): number {
  return new Date().getTime();
}

function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`site-header ${compact ? "site-header--compact" : ""}`}>
      <Link className="brand" href="/" aria-label="AI星座搭子首页">
        <span className="brand-mark" aria-hidden="true">✦</span>
        <span>AI星座搭子</span>
        <span className="brand-version">v0.3</span>
      </Link>
      <nav className="site-nav" aria-label="主导航">
        <Link href="/explore">12人格</Link>
      </nav>
    </header>
  );
}

function AxisChart({ persona }: { persona: ZodiacPersona }) {
  return (
    <div className="axis-chart" aria-label={`${persona.nameZh}六项沟通轴`}>
      {AXIS_KEYS.map((key) => (
        <div className="axis-row" key={key}>
          <div className="axis-label">
            <span>{AXIS_LABELS[key]}</span>
            <strong>{persona.axes[key]}</strong>
          </div>
          <div className="axis-track">
            <span style={{ width: `${persona.axes[key]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonaTile({
  persona,
  active = false,
  onClick,
}: {
  persona: ZodiacPersona;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`persona-tile ${active ? "is-active" : ""}`}
      style={personaStyle(persona)}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="persona-tile-symbol" aria-hidden="true">
        {persona.symbol}
      </span>
      <span className="persona-tile-copy">
        <strong>{persona.nameZh}</strong>
        <small>{persona.traits[0]} · {persona.traits[1]}</small>
      </span>
      <span className="persona-tile-arrow" aria-hidden="true">↗</span>
    </button>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <span className="brand-mark" aria-hidden="true">✦</span>
        <strong>AI星座搭子</strong>
      </div>
      <p>星座文化启发的AI沟通风格 · 仅供娱乐 · 非心理测量或命运预测</p>
      <p>MIT License · 12套人格JSON开放复用</p>
    </footer>
  );
}

export function ZodiacApp({
  initialView,
  sharedPersonaId,
  sharedDuel,
}: ZodiacAppProps) {
  const sharedPersona = sharedPersonaId ? getPersona(sharedPersonaId) : undefined;
  const [view, setView] = useState<AppView>(
    initialView === "home" && sharedDuel
      ? "duel"
      : initialView === "home" && sharedPersona
        ? "result"
        : initialView,
  );
  const [selected, setSelected] = useState<ZodiacPersona>(
    sharedPersona ??
      (sharedDuel ? getPersona(sharedDuel.sharedChoiceId)! : PERSONAS[0]),
  );
  const [alternatives, setAlternatives] = useState<ZodiacPersona[]>([]);
  const [match, setMatch] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizLocked, setQuizLocked] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<number | null>(null);
  const [duelRound, setDuelRound] = useState<DuelRound | null>(
    sharedDuel ?? null,
  );
  const [duelChoice, setDuelChoice] = useState<ZodiacId | null>(null);
  const [duelConfirmed, setDuelConfirmed] = useState(false);
  const [duelSourceId, setDuelSourceId] = useState<string | null>(
    sharedDuel?.sourceId ?? null,
  );
  const [sharedChoiceId, setSharedChoiceId] = useState<ZodiacId | null>(
    sharedDuel?.sharedChoiceId ?? null,
  );
  const [isReferralRound, setIsReferralRound] = useState(Boolean(sharedDuel));
  const [localState, setLocalState] = useState<LocalCompanionState | null>(null);
  const [activeModeId, setActiveModeId] = useState<TaskModeId | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [failedMessages, setFailedMessages] = useState<ChatMessage[] | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [toast, setToast] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const questionTitleRef = useRef<HTMLHeadingElement | null>(null);
  const quizTimerRef = useRef<number | null>(null);
  const localStateRef = useRef<LocalCompanionState | null>(null);
  const lastDuelViewRef = useRef("");
  const referralTrackedRef = useRef(false);
  const firstChatTracked = useRef(false);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const persistLocalState = (next: LocalCompanionState) => {
    localStateRef.current = next;
    setLocalState(next);
    window.localStorage.setItem(LOCAL_COMPANION_KEY, JSON.stringify(next));
  };

  const persistSession = (persona: ZodiacPersona, messages: ChatMessage[]) => {
    persistLocalState(
      saveLocalSession(
        localStateRef.current,
        persona.id,
        messages,
        browserTimestamp(),
      ),
    );
  };

  const persistMode = (modeId: TaskModeId | null) => {
    setActiveModeId(modeId);
    persistLocalState(saveLocalMode(localStateRef.current, modeId));
  };

  const clearLocalState = () => {
    window.localStorage.removeItem(LOCAL_COMPANION_KEY);
    localStateRef.current = null;
    setLocalState(null);
    setActiveModeId(null);
    showToast("已清除这台设备上的搭子和会话");
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = parseLocalCompanionState(
        window.localStorage.getItem(LOCAL_COMPANION_KEY),
      );
      localStateRef.current = restored;
      setLocalState(restored);
      setActiveModeId(restored?.modeId ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (view !== "quiz") return;
    const frame = window.requestAnimationFrame(() => {
      questionTitleRef.current?.focus({ preventScroll: true });
      questionTitleRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, answers.length]);

  useEffect(
    () => () => {
      if (quizTimerRef.current !== null) {
        window.clearTimeout(quizTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chatMessages, isSending]);

  useEffect(() => {
    if (view !== "duel" || !duelRound) return;
    const key = `${duelRound.scenarioId}:${duelRound.leftId}:${duelRound.rightId}`;
    if (lastDuelViewRef.current === key) return;
    lastDuelViewRef.current = key;
    trackAnonymousEvent("duel_view", {
      personaId: duelRound.leftId,
      scenarioId: duelRound.scenarioId,
      ...(duelSourceId ? { sourceId: duelSourceId } : {}),
    });
  }, [duelRound, duelSourceId, view]);

  useEffect(() => {
    if (!sharedDuel || referralTrackedRef.current) return;
    referralTrackedRef.current = true;
    trackAnonymousEvent("referral_open", {
      personaId: sharedDuel.sharedChoiceId,
      scenarioId: sharedDuel.scenarioId,
      sourceId: sharedDuel.sourceId,
    });
  }, [sharedDuel]);

  const featured = useMemo(
    () => [getPersona("aries")!, getPersona("virgo")!, getPersona("pisces")!],
    [],
  );
  const confirmedPersona = localState?.confirmedPersonaId
    ? getPersona(localState.confirmedPersonaId)
    : undefined;
  const activeMode = activeModeId ? getTaskMode(activeModeId) : null;

  const goHome = () => {
    setView("home");
    setAnswers([]);
    setDuelRound(null);
    setDuelChoice(null);
    setDuelConfirmed(false);
    window.history.replaceState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startQuiz = () => {
    setAnswers([]);
    setQuizLocked(false);
    setQuizFeedback(null);
    setIsReferralRound(false);
    setDuelSourceId(null);
    setSharedChoiceId(null);
    setView("quiz");
    window.history.replaceState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openDuel = (
    persona: ZodiacPersona,
    nextAlternatives = PERSONAS.filter((item) => item.id !== persona.id).slice(0, 2),
    nextMatch: number | null = null,
  ) => {
    setSelected(persona);
    setAlternatives(nextAlternatives);
    setMatch(nextMatch);
    setDuelRound(createDuelRound(persona.id));
    setDuelChoice(null);
    setDuelConfirmed(false);
    setDuelSourceId(null);
    setSharedChoiceId(null);
    setIsReferralRound(false);
    lastDuelViewRef.current = "";
    setView("duel");
    window.history.replaceState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseDirectly = (persona: ZodiacPersona) => openDuel(persona);

  const answerQuestion = (optionIndex: number) => {
    if (quizLocked) return;
    const nextAnswers = [...answers, optionIndex];
    setQuizFeedback(optionIndex);
    setQuizLocked(true);
    quizTimerRef.current = window.setTimeout(() => {
      if (nextAnswers.length === QUIZ_QUESTIONS.length) {
        const recommendations = recommendPersonas(nextAnswers);
        setAnswers(nextAnswers);
        trackAnonymousEvent("quiz_completed");
        openDuel(
          recommendations[0].persona,
          recommendations.slice(1).map((item) => item.persona),
          recommendations[0].match,
        );
      } else {
        setAnswers(nextAnswers);
      }
      setQuizFeedback(null);
      setQuizLocked(false);
      quizTimerRef.current = null;
    }, 220);
  };

  const previousQuestion = () => {
    if (quizLocked || answers.length === 0) return;
    setQuizFeedback(null);
    setAnswers((current) => current.slice(0, -1));
  };

  const startChat = (
    persona = selected,
    modeId: TaskModeId | null = null,
    trackSelection = false,
  ) => {
    const storedSession = localStateRef.current?.session;
    const initialMessages =
      storedSession?.personaId === persona.id
        ? storedSession.messages
        : [
            {
              role: "assistant" as const,
              content: `嗨，我是你的${persona.nameZh}AI搭子。${persona.tagline}。今天想一起解决什么？`,
            },
          ];
    setSelected(persona);
    persistMode(modeId);
    if (trackSelection && modeId) {
      trackAnonymousEvent("mode_selected", {
        personaId: persona.id,
        modeId,
      });
    }
    setChatMessages(initialMessages);
    setChatError("");
    setFailedMessages(null);
    setQuotaRemaining(null);
    persistSession(persona, initialMessages);
    setView("chat");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectChatMode = (modeId: TaskModeId | null) => {
    if (isSending || activeModeId === modeId) return;
    persistMode(modeId);
    if (modeId) {
      trackAnonymousEvent("mode_selected", {
        personaId: selected.id,
        modeId,
      });
    }
  };

  const fillModeStarter = (starter: string) => {
    if (!activeModeId) return;
    setChatInput(starter);
    trackAnonymousEvent("mode_starter_used", {
      personaId: selected.id,
      modeId: activeModeId,
    });
  };

  const requestChat = async (nextMessages: ChatMessage[]) => {
    setChatError("");
    setIsSending(true);
    const confirmedPersonaId = localStateRef.current?.confirmedPersonaId;
    const requestModeId = activeModeId;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-zodiac-device": getAnonymousDeviceId(),
          ...(confirmedPersonaId === selected.id
            ? { "x-zodiac-confirmed-persona": confirmedPersonaId }
            : {}),
        },
        body: JSON.stringify({
          personaId: selected.id,
          messages: nextMessages,
          ...(requestModeId ? { modeId: requestModeId } : {}),
        }),
      });
      const result = (await response.json()) as {
        reply?: string;
        error?: string;
        quota?: { remaining: number };
      };
      if (!response.ok || !result.reply) {
        throw new Error(result.error || "AI线路暂时繁忙，请稍后再试。");
      }
      const completedMessages: ChatMessage[] = [
        ...nextMessages,
        { role: "assistant", content: result.reply! },
      ];
      setChatMessages(completedMessages);
      persistSession(selected, completedMessages);
      setFailedMessages(null);
      setQuotaRemaining(result.quota?.remaining ?? null);
      if (!firstChatTracked.current) {
        firstChatTracked.current = true;
        trackAnonymousEvent("first_chat");
      }
      if (requestModeId) {
        trackAnonymousEvent("mode_chat_success", {
          personaId: selected.id,
          modeId: requestModeId,
        });
      }
    } catch (error) {
      setFailedMessages(nextMessages);
      persistSession(selected, nextMessages);
      setChatError(
        error instanceof Error
          ? error.message
          : "AI线路暂时繁忙，请稍后再试。",
      );
    } finally {
      setIsSending(false);
    }
  };

  const sendChat = async (preset?: string) => {
    const content = (preset ?? chatInput).trim();
    if (!content || isSending) return;
    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content },
    ];
    setChatMessages(nextMessages);
    persistSession(selected, nextMessages);
    setChatInput("");
    setFailedMessages(null);
    await requestChat(nextMessages);
  };

  const retryChat = async () => {
    if (!failedMessages || isSending) return;
    await requestChat(failedMessages);
  };

  const onChatKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendChat();
    }
  };

  const copyPrompt = async (persona = selected) => {
    await navigator.clipboard.writeText(compileSystemPrompt(persona));
    trackAnonymousEvent("prompt_copied");
    showToast(`${persona.nameZh} System Prompt 已复制`);
  };

  const downloadJson = (persona = selected) => {
    const blob = new Blob([JSON.stringify(persona, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    triggerDownload(blob, `${persona.id}.v${persona.version}.json`);
    showToast(`${persona.nameZh}人格JSON已下载`);
  };

  const chooseDuelChannel = (personaId: ZodiacId) => {
    if (!duelRound || duelChoice) return;
    const persona = getPersona(personaId);
    if (!persona) return;
    setDuelChoice(personaId);
    setSelected(persona);
    setMatch(matchForDuelChoice(duelRound, personaId, match));
    trackAnonymousEvent(isReferralRound ? "referred_choice" : "duel_choice", {
      personaId,
      scenarioId: duelRound.scenarioId,
      ...(duelSourceId ? { sourceId: duelSourceId } : {}),
    });
  };

  const confirmDuelPersona = () => {
    if (!duelRound || !duelChoice || duelConfirmed) return;
    const next = confirmLocalPersona(localStateRef.current, duelChoice);
    persistLocalState(next);
    setDuelConfirmed(true);
    trackAnonymousEvent("persona_confirmed", {
      personaId: duelChoice,
      scenarioId: duelRound.scenarioId,
      ...(duelSourceId ? { sourceId: duelSourceId } : {}),
    });
    showToast(`${getPersona(duelChoice)!.nameZh}已设为你的AI搭子`);
  };

  const createShareSourceId = () => {
    const token =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    return `share_${token}`;
  };

  const shareResult = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    const duelShare =
      view === "duel" && duelRound && duelChoice
        ? { round: duelRound, choice: duelChoice }
        : null;
    const sourceId = duelShare ? createShareSourceId() : null;
    const shareUrl = duelShare
      ? new URL(
          buildDuelSharePath(duelShare.round, duelShare.choice, sourceId!),
          window.location.origin,
        )
      : new URL(`/?persona=${selected.id}`, window.location.origin);
    try {
      const blob = duelShare
        ? await createDuelShareCard(duelShare.round, shareUrl.toString())
        : await createShareCard(selected, shareUrl.toString());
      if (duelShare && sourceId) {
        trackAnonymousEvent("share_generated", {
          personaId: duelShare.choice,
          scenarioId: duelShare.round.scenarioId,
          sourceId,
        });
      } else {
        trackAnonymousEvent("share_clicked");
      }
      const file = new File(
        [blob],
        duelShare
          ? "同题双声道-邀请卡.png"
          : `我的AI搭子-${selected.nameZh}.png`,
        { type: "image/png" },
      );
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: duelShare ? "同一道题，你会选哪种AI回答？" : `我的AI搭子是${selected.nameZh}`,
          text: duelShare ? "我已经选了一次，轮到你了。" : selected.tagline,
          url: shareUrl.toString(),
          files: [file],
        });
        showToast("分享卡已打开系统分享");
      } else {
        triggerDownload(blob, file.name);
        await navigator.clipboard?.writeText(shareUrl.toString()).catch(() => undefined);
        showToast("分享卡已下载，链接也已复制");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        showToast(error instanceof Error ? error.message : "分享卡生成失败");
      }
    } finally {
      setShareBusy(false);
    }
  };

  if (view === "quiz") {
    const question = QUIZ_QUESTIONS[answers.length];
    return (
      <main className="app-shell quiz-page">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <section className="quiz-wrap">
          <div className="quiz-nav-row">
            <button className="text-button back-button" onClick={goHome}>← 返回首页</button>
            <button
              className="text-button"
              onClick={previousQuestion}
              disabled={answers.length === 0 || quizLocked}
            >
              ← 上一题
            </button>
          </div>
          <div className="quiz-progress-row">
            <span>AI搭子默契测试</span>
            <strong>{answers.length + 1} / {QUIZ_QUESTIONS.length}</strong>
          </div>
          <div className="quiz-progress" aria-label={`第${answers.length + 1}题，共6题`}>
            {QUIZ_QUESTIONS.map((item, index) => (
              <span
                className={
                  index < answers.length
                    ? "is-filled"
                    : index === answers.length
                      ? "is-current"
                      : ""
                }
                key={item.id}
              />
            ))}
          </div>
          <article className="quiz-card" key={question.id}>
            <p className="eyebrow">情境 {answers.length + 1} · {question.eyebrow}</p>
            <h1 ref={questionTitleRef} tabIndex={-1}>{question.question}</h1>
            <p className="quiz-hint">跟着第一反应选，没有标准答案。</p>
            <div className="quiz-options">
              {question.options.map((option, index) => (
                <button
                  className={quizFeedback === index ? "is-selected" : ""}
                  onClick={() => answerQuestion(index)}
                  disabled={quizLocked}
                  aria-pressed={quizFeedback === index}
                  key={option.label}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  <strong>{option.label}</strong>
                  <i aria-hidden="true">{quizFeedback === index ? "✓" : "→"}</i>
                </button>
              ))}
            </div>
          </article>
          <p className="privacy-note">不上传你的答案 · 不用于真人性格判断</p>
        </section>
      </main>
    );
  }

  if (view === "duel" && duelRound) {
    const leftPersona = getPersona(duelRound.leftId)!;
    const rightPersona = getPersona(duelRound.rightId)!;
    const chosenPersona = duelChoice ? getPersona(duelChoice)! : null;
    const friendChannel = sharedChoiceId
      ? sharedChoiceId === duelRound.leftId
        ? "A"
        : "B"
      : null;
    const myChannel = duelChoice
      ? duelChoice === duelRound.leftId
        ? "A"
        : "B"
      : null;
    return (
      <main className="app-shell duel-page">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <SiteHeader compact />
        <section className="duel-wrap">
          <div className="duel-topline">
            <button className="text-button" onClick={goHome}>← 回到首页</button>
            <span>{isReferralRound ? "朋友邀请你来选" : "同题双声道 · 不调用模型"}</span>
          </div>
          <header className="duel-heading">
            <p className="eyebrow">LISTEN BEFORE LABELS</p>
            <h1>{duelRound.prompt}</h1>
            <p>
              {duelChoice
                ? "身份已经揭晓。看看你更偏好的沟通方式差在哪里。"
                : "先不看星座身份，只凭这句话选出更对味的一边。"}
            </p>
          </header>
          <div className="duel-grid" aria-label="两种AI沟通回答">
            {(
              [
                ["A", duelRound.leftId, duelRound.leftReply, leftPersona],
                ["B", duelRound.rightId, duelRound.rightReply, rightPersona],
              ] as const
            ).map(([channel, personaId, reply, persona]) => (
              <button
                className={`duel-voice ${
                  duelChoice === personaId ? "is-chosen" : ""
                } ${duelChoice && duelChoice !== personaId ? "is-muted" : ""}`}
                onClick={() => chooseDuelChannel(personaId)}
                disabled={Boolean(duelChoice)}
                aria-label={`选择声道 ${channel} 的回答`}
                key={channel}
              >
                <span className="duel-channel">声道 {channel}</span>
                {duelChoice && (
                  <span className="duel-identity">
                    <i aria-hidden="true">{persona.symbol}</i>
                    <strong>{persona.nameZh}</strong>
                  </span>
                )}
                <q>{reply}</q>
                <span className="duel-pick">
                  {duelChoice === personaId ? "✓ 你选了这句" : "这句更对味 →"}
                </span>
              </button>
            ))}
          </div>

          {duelChoice && chosenPersona && (
            <section className="duel-reveal" aria-live="polite">
              <p className="eyebrow">WHY IT FEELS DIFFERENT</p>
              <h2>你更对味的是 {chosenPersona.nameZh}</h2>
              <p>{getDuelDifference(duelRound.leftId, duelRound.rightId)}</p>
              {friendChannel && (
                <div className="referral-result">
                  朋友选了声道 {friendChannel}，你选了声道 {myChannel}：
                  {friendChannel === myChannel ? "你们这次很同频。" : "你们偏好的表达方式不一样。"}
                </div>
              )}
              {!duelConfirmed ? (
                <div className="duel-actions">
                  {isReferralRound && (
                    <button className="primary-button" onClick={startQuiz}>
                      开始我的6题测试 <span>→</span>
                    </button>
                  )}
                  <button
                    className={isReferralRound ? "secondary-button" : "primary-button"}
                    onClick={confirmDuelPersona}
                  >
                    设为我的 AI 搭子
                  </button>
                </div>
              ) : (
                <div className="duel-actions duel-actions--confirmed">
                  <div className="duel-confirmed-note">✓ 只保存在当前浏览器，可随时清除或覆盖</div>
                  <ModeSelector
                    persona={chosenPersona}
                    activeModeId={activeModeId}
                    onSelect={(modeId) => startChat(chosenPersona, modeId, true)}
                  />
                  <button className="primary-button" onClick={() => startChat(chosenPersona)}>
                    直接和{chosenPersona.nameZh}聊天 <span>→</span>
                  </button>
                  <button className="secondary-button" onClick={() => setView("result")}>
                    查看完整人格结果
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void shareResult()}
                    disabled={shareBusy}
                  >
                    {shareBusy ? "正在生成…" : "把同一题发给朋友"}
                  </button>
                </div>
              )}
            </section>
          )}
          <p className="privacy-note">预置审核内容 · 不使用问卷答案或聊天正文 · 无需登录</p>
        </section>
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    );
  }

  if (view === "result") {
    return (
      <main className="app-shell result-page" style={personaStyle(selected)}>
        <div className="ambient ambient-persona" />
        <SiteHeader compact />
        <section className="result-wrap">
          <div className="result-topline">
            <button className="text-button" onClick={goHome}>← 回到首页</button>
            <span>{match ? "测试完成" : "直觉选择"}</span>
          </div>
          <div className="result-grid">
            <article className="result-identity-card">
              <div className="result-card-shine" />
              <div className="result-card-meta">
                <span>YOUR AI PERSONA</span>
                <span>{ELEMENT_LABELS[selected.element]} · v{selected.version}</span>
              </div>
              <div className="result-symbol" aria-hidden="true">{selected.symbol}</div>
              <p>最合拍的AI搭子</p>
              <h1>{selected.nameZh}</h1>
              {match && <strong className="match-badge">默契度 {match}%</strong>}
              <h2>“{selected.tagline}”</h2>
              <div className="trait-row">
                {selected.traits.slice(0, 3).map((trait) => <span key={trait}>{trait}</span>)}
              </div>
              <div className="result-card-footer">
                <span>AI星座搭子</span>
                <span>✦ ZODIAC PERSONA KIT</span>
              </div>
            </article>

            <div className="result-details">
              <div className="section-label">你的沟通偏好光谱</div>
              <AxisChart persona={selected} />
              <div className="fit-card">
                <span aria-hidden="true">◎</span>
                <div>
                  <small>它最适合这样帮助你</small>
                  <strong>{selected.prompt.identity.replace("你是一位", "作为一位")}</strong>
                  <p>{selected.communication.answerShape}。{selected.communication.encouragement}。</p>
                </div>
              </div>
              <div className="result-actions">
                <button className="primary-button" onClick={() => startChat()}>
                  开始和{selected.nameZh}聊天 <span>→</span>
                </button>
                <button className="secondary-button" onClick={() => void shareResult()} disabled={shareBusy}>
                  {shareBusy ? "正在生成分享卡…" : "生成分享卡"}
                </button>
                <button className="secondary-button" onClick={() => void copyPrompt()}>
                  复制人格提示词
                </button>
                <button className="icon-button" onClick={() => downloadJson()} aria-label="下载人格JSON">↓ JSON</button>
              </div>
              {localState?.confirmedPersonaId === selected.id && (
                <ModeSelector
                  persona={selected}
                  activeModeId={activeModeId}
                  onSelect={(modeId) => startChat(selected, modeId, true)}
                />
              )}
            </div>
          </div>

          {alternatives.length > 0 && (
            <section className="alternatives-section">
              <div>
                <p className="section-label">也很合拍</p>
                <h2>你的另外两位候选搭子</h2>
              </div>
              <div className="alternatives-list">
                {alternatives.map((persona) => (
                  <PersonaTile key={persona.id} persona={persona} onClick={() => chooseDirectly(persona)} />
                ))}
              </div>
            </section>
          )}
          <div className="result-disclaimer">
            <span>i</span>
            <p>六个轴是产品设计参数，不是心理测量结果。星座只作为熟悉、有趣的沟通隐喻，不预测命运，也不判断真人。</p>
            <Link href="/explore">看看全部12人格 →</Link>
          </div>
        </section>
        <Footer />
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    );
  }

  if (view === "chat") {
    return (
      <main className="app-shell chat-page" style={personaStyle(selected)}>
        <div className="ambient ambient-persona" />
        <SiteHeader compact />
        <section className="chat-layout">
          <aside className="chat-persona-panel">
            <button className="text-button" onClick={() => setView("result")}>← 返回结果</button>
            <div className="chat-persona-symbol" aria-hidden="true">{selected.symbol}</div>
            <p>你正在和</p>
            <h1>{selected.nameZh}AI搭子</h1>
            <strong>“{selected.tagline}”</strong>
            <div className="trait-row">
              {selected.traits.map((trait) => <span key={trait}>{trait}</span>)}
            </div>
            <div className="local-session-note">
              <span aria-hidden="true">◉</span>
              <p><strong>本地当前会话</strong><br />服务端不保存聊天正文，只发送最近4轮。</p>
            </div>
            <button className="secondary-button" onClick={() => void copyPrompt()}>复制这套人格</button>
            <button className="text-button clear-local-button" onClick={clearLocalState}>清除本地搭子与会话</button>
          </aside>

          <section className="chat-window" aria-label="AI聊天窗口">
            <header className="chat-window-header">
              <button className="mobile-chat-back" onClick={() => setView("result")}>
                ← 返回结果
              </button>
              <div>
                <span className="online-dot" />
                {activeMode ? `${activeMode.icon} ${activeMode.name}模式` : "直接聊天"}
              </div>
              {quotaRemaining !== null && <span>今天还可聊 {quotaRemaining} 条</span>}
            </header>
            <div className="chat-mode-switch" aria-label="切换任务模式">
              <button
                className={!activeModeId ? "is-active" : ""}
                onClick={() => selectChatMode(null)}
                disabled={isSending}
                aria-pressed={!activeModeId}
              >
                直接聊
              </button>
              {TASK_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={activeModeId === mode.id ? "is-active" : ""}
                  onClick={() => selectChatMode(mode.id)}
                  disabled={isSending}
                  aria-pressed={activeModeId === mode.id}
                >
                  <span aria-hidden="true">{mode.icon}</span> {mode.name}
                </button>
              ))}
            </div>
            <div className="messages" aria-live="polite">
              {chatMessages.map((message, index) => (
                <div className={`message message--${message.role}`} key={`${message.role}-${index}`}>
                  {message.role === "assistant" && <span className="message-avatar">{selected.symbol}</span>}
                  <div>
                    <small>{message.role === "assistant" ? selected.nameZh : "你"}</small>
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="message message--assistant">
                  <span className="message-avatar">{selected.symbol}</span>
                  <div className="typing" aria-label="AI正在回复"><i /><i /><i /></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {chatMessages.length <= 1 && (
              activeMode ? (
                <div className="mode-empty-state">
                  <div>
                    <strong>{activeMode.name}模式 · {activeMode.tagline}</strong>
                    <span>{activeMode.description}</span>
                  </div>
                  <div className="mode-starters">
                    {activeMode.starters.map((starter) => (
                      <button key={starter} onClick={() => fillModeStarter(starter)}>
                        {starter}
                      </button>
                    ))}
                  </div>
                  <small>点一下只会填入输入框，你可以改好再发送。</small>
                </div>
              ) : (
                <div className="quick-prompts">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button key={prompt} onClick={() => void sendChat(prompt)}>{prompt}</button>
                  ))}
                </div>
              )
            )}
            {chatError && (
              <div className="chat-error" role="alert">
                <strong>暂时没连上AI</strong>
                <span>{chatError}</span>
                <div className="chat-error-actions">
                  <button onClick={() => void retryChat()} disabled={isSending}>
                    {isSending ? "重试中…" : "重试这条消息"}
                  </button>
                  <button onClick={() => void copyPrompt()}>复制人格提示词</button>
                </div>
              </div>
            )}
            <div className="chat-composer">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={onChatKeyDown}
                placeholder={`问${selected.nameZh}任何实际问题…`}
                maxLength={1000}
                rows={2}
                aria-label="输入聊天消息"
              />
              <div className="composer-footer">
                <span>{chatInput.length}/1000 · Enter发送，Shift+Enter换行</span>
                <button onClick={() => void sendChat()} disabled={!chatInput.trim() || isSending} aria-label="发送消息">↑</button>
              </div>
            </div>
            <p className="model-note">AI可能会犯错，重要信息请核实。人格只改变表达方式，不改变事实标准。</p>
          </section>
        </section>
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    );
  }

  if (view === "explore") {
    return (
      <main className="app-shell explore-page" style={personaStyle(selected)}>
        <div className="ambient ambient-persona" />
        <SiteHeader />
        <section className="explore-hero">
          <p className="eyebrow">OPEN PERSONA COLLECTION · 0.1</p>
          <h1>12种表达，<br /><span>同一种认真。</span></h1>
          <p>每一套都是可读、可改、可复制的开放AI人格。选一个试听，也可以直接带走JSON。</p>
        </section>
        <section className="explore-layout">
          <div className="persona-gallery" aria-label="十二星座人格列表">
            {PERSONAS.map((persona) => (
              <PersonaTile
                key={persona.id}
                persona={persona}
                active={selected.id === persona.id}
                onClick={() => setSelected(persona)}
              />
            ))}
          </div>
          <article className="persona-spotlight" style={personaStyle(selected)}>
            <div className="spotlight-top">
              <span>{ELEMENT_LABELS[selected.element]} · {selected.id.toUpperCase()}</span>
              <span>v{selected.version}</span>
            </div>
            <div className="spotlight-title">
              <span aria-hidden="true">{selected.symbol}</span>
              <div><p>当前人格</p><h2>{selected.nameZh}</h2></div>
            </div>
            <blockquote>“{selected.tagline}”</blockquote>
            <div className="trait-row">
              {selected.traits.map((trait) => <span key={trait}>{trait}</span>)}
            </div>
            <AxisChart persona={selected} />
            <div className="demo-dialogue">
              <p className="section-label">试听一段</p>
              <div><small>你</small><p>{selected.prompt.examples[0].user}</p></div>
              <div className="demo-answer"><small>{selected.nameZh}</small><p>{selected.prompt.examples[0].assistant}</p></div>
            </div>
            <div className="spotlight-actions">
              <button className="primary-button" onClick={() => startChat(selected)}>和它聊聊 <span>→</span></button>
              <button className="secondary-button" onClick={() => void copyPrompt(selected)}>复制Prompt</button>
              <button className="secondary-button" onClick={() => downloadJson(selected)}>下载JSON</button>
            </div>
          </article>
        </section>
        <section className="open-callout">
          <div><span>OPEN</span><strong>人格不是黑箱。</strong></div>
          <p>六轴参数、沟通规则、禁用行为和示例全部公开。你可以审阅、修改、二次创作，也欢迎贡献更好的表达。</p>
          <button onClick={() => void copyPrompt(selected)}>先复制当前人格 →</button>
        </section>
        <Footer />
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="app-shell home-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <SiteHeader />
      {confirmedPersona && (
        <section className="home-resume" style={personaStyle(confirmedPersona)}>
          <span className="home-resume-symbol" aria-hidden="true">{confirmedPersona.symbol}</span>
          <div>
            <small>这台设备上的 AI 搭子</small>
            <strong>{confirmedPersona.nameZh} · {confirmedPersona.tagline}</strong>
          </div>
          <button
            className="primary-button"
            onClick={() => startChat(confirmedPersona, activeModeId)}
          >
            {activeMode ? `继续${activeMode.name}模式` : "继续聊天"} <span>→</span>
          </button>
          <button className="text-button" onClick={clearLocalState}>清除本地记录</button>
          <ModeSelector
            persona={confirmedPersona}
            activeModeId={activeModeId}
            onSelect={(modeId) => startChat(confirmedPersona, modeId, true)}
          />
        </section>
      )}
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span>V0.3</span> 同一人格，三种任务模式</p>
          <h1>
            <span className="hero-title-line">你的AI，</span>
            <span className="hero-title-line">
              应该是什么<span className="hero-title-accent">星座？</span>
            </span>
          </h1>
          <p className="hero-lead">同一道题，让两种AI回答给你听；选出更对味的那个，再让朋友也选一次。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={startQuiz}>测测我的AI搭子 <span>→</span></button>
            <a className="secondary-button" href="#pick">我知道，直接选</a>
          </div>
          <div className="hero-proof">
            <span>✓ 无需注册</span><span>✓ 约1分钟</span><span>✓ 12套人格开放复用</span>
          </div>
        </div>
        <div className="hero-deck" aria-label="白羊、处女、双鱼三种人格预览">
          {featured.map((persona, index) => (
            <button
              key={persona.id}
              className={`deck-card deck-card--${index + 1}`}
              style={personaStyle(persona)}
              onClick={() => chooseDirectly(persona)}
            >
              <span className="deck-index">0{index + 1}</span>
              <span className="deck-symbol">{persona.symbol}</span>
              <small>{ELEMENT_LABELS[persona.element]}人格</small>
              <strong>{persona.nameZh}</strong>
              <p>{persona.tagline}</p>
              <i>点击体验 ↗</i>
            </button>
          ))}
          <div className="orbit-label orbit-label--one">直接行动</div>
          <div className="orbit-label orbit-label--two">结构审查</div>
          <div className="orbit-label orbit-label--three">共情想象</div>
        </div>
      </section>

      <section className="pick-section" id="pick">
        <div className="section-heading">
          <div><p className="eyebrow">PICK YOUR PERSONA</p><h2>凭直觉，选一个搭子</h2></div>
          <Link href="/explore">看全部人格详情 →</Link>
        </div>
        <div className="quick-zodiac-grid">
          {PERSONAS.map((persona) => (
            <button key={persona.id} style={personaStyle(persona)} onClick={() => chooseDirectly(persona)}>
              <span>{persona.symbol}</span><strong>{persona.nameZh.replace("座", "")}</strong><small>{persona.traits[0]}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="how-section">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2>不贴你的标签，<br />只调AI的频道。</h2>
        <div className="how-grid">
          <article><span>01</span><strong>6题找到偏好</strong><p>题目只映射沟通轴，不推断你的真人性格。</p></article>
          <article><span>02</span><strong>同题听两种回答</strong><p>先隐藏身份，凭表达选出更对味的沟通方式。</p></article>
          <article><span>03</span><strong>确认并带走搭子</strong><p>本地续聊、邀请朋友选择，也可复制Prompt或JSON。</p></article>
        </div>
      </section>
      <Footer />
    </main>
  );
}
