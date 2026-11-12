# WISEMAN — RESEARCH SESSION 001

iOS / Bluetooth — Memory Integrity & Trust Boundaries

最終脚本・映像制作向け統合版

既に合意した冒頭の台詞、5人の役割、iOS/Bluetoothの脆弱性調査、ROOTのロシア語への切り替わり、そして誰もそれに触れない演出を統合した完全版だ。

過去の脚本全文を逐語的には復元できないため、以下は確定済みの重要台詞を維持し、会議全体を再構成した版になる。

想定尺

約7〜8分（間・操作演出込み）

言語

American English / Russian

音声

ORACLE / GHOST / ZERO / SPECTER

ROOT

字幕＋Speaking波形、音声なし

## ACT I — Reassembly

00:00–01:05 · SESSION ESTABLISHED

暗転。接続音。画面に「WISEMAN」。参加者が順次接続される。

SESSION ACTIVITY

SECURE CHANNEL ESTABLISHED
ORACLE CONNECTED
GHOST CONNECTED
ZERO CONNECTED
SPECTER CONNECTED
ROOT CONNECTED

5 PARTICIPANTS · ENCRYPTED


ORACLE

> It's been a while since we've operated under the WISEMAN name.
>
> We've all remained active in our own circles, but it's time we brought our work together again.
>
> Let's keep this brief, objective, and evidence-driven.
>
> No assumptions. No unnecessary speculation.
>
> Let's get to work.

短い沈黙。

GHOST

> Good to hear everyone again. I've reviewed the latest Apple security disclosures. There are a few things worth discussing.

ZERO

> I've been looking at the ARM64 side. There are some interesting implications, particularly around pointer authentication and object lifetime.

SPECTER

> I've been following the browser-side research. Different attack surface, but some of the underlying questions are familiar.

ROOT [字幕のみ]

> Then let's establish the boundaries first. What do we actually know, and what are we merely assuming?

ORACLE

> Agreed. Ghost, start with Bluetooth.

## ACT II — Bluetooth and iOS

01:05–02:20 · INITIAL FINDINGS

GHOST

> The Bluetooth-related disclosures are what caught my attention.
>
> We have reports involving memory corruption, pairing behavior, and insufficient restrictions on authentication attempts.
>
> Three different issues. Potentially three different failure modes.

ORACLE

> Any evidence that they're connected?

GHOST

> Not at this point.
>
> CVE-2026-113970 is associated with a Bluetooth use-after-free condition.
>
> CVE-2026-113965 and CVE-2026-113964 concern pairing-related behavior in CoreUtils.
>
> We shouldn't treat them as a single vulnerability chain without evidence.

ZERO

> Right. A use-after-free is a memory-lifetime problem. A pairing restriction failure is a trust-boundary problem.
>
> Similar consequences don't imply a common cause.

SPECTER

> And the entry point matters. Bluetooth is not WebKit. We shouldn't confuse an externally reachable surface with an established exploitation path.

ROOT [字幕のみ]

> The interesting question is whether the security boundary fails before or after the system accepts the external input.
>
> If Bluetooth pairing state is trusted too early, the consequences could be broader than the individual validation failure.
>
> But that's a hypothesis, not a finding.

ORACLE

> Good. Keep the distinction explicit.

## ACT III — Memory Corruption

02:20–03:35 · TECHNICAL DISCUSSION

ZERO

> On ARM64, pointer authentication complicates the picture.
>
> PAC can help detect certain forms of pointer manipulation, but it doesn't guarantee memory safety.
>
> A pointer can be authenticated and still refer to an object whose lifetime has already ended.

GHOST

> Exactly. The question isn't simply whether the pointer is valid.
>
> It's whether the object is still logically owned by the component accessing it.

SPECTER

> We've seen similar reasoning applied to browser memory-safety investigations.
>
> JIT behavior, object lifetime, and state transitions can interact in complicated ways.
>
> That doesn't mean the Bluetooth issue shares the same root cause.

ORACLE

> So what would distinguish a conventional memory-corruption bug from a deeper ownership failure?

ZERO

> Reproducible evidence.
>
> We need to identify the object state before the transition, the operation that changes ownership, and the first access that violates the expected lifetime.

ROOT [字幕のみ]

> And we need to avoid mistaking a crash signature for a complete explanation.
>
> A crash tells us where execution failed. It doesn't necessarily tell us where the invariant was first violated.

GHOST

> That's the problem with relying on a single crash report.
>
> You can identify the symptom and still misunderstand the defect.

ORACLE

> Then we proceed from observable behavior, not from the most convenient theory.

## ACT IV — The Slip

03:35–04:40 · UNEXPECTED LANGUAGE SWITCH

この場面が演出上の核心。ROOTのSpeaking表示が点灯し、波形が通常どおり動く。

ROOT [字幕のみ]

> There's something else.
>
> If the ownership transition happens asynchronously, then the failure may not occur at the point where the object is released.
>
> The issue isn't necessarily the pointer itself.
>
> It's the assumption that the object remains valid after the ownership boundary changes—

ROOTの発言が突然途切れる。約0.7秒の間。

ROOT

SPEAKING

# Нет, подожди... чёрт.

ニェート、パダジー……チョルト。

発音参考：Nyet, podozhdi... chyort.意味：いや、待て……くそっ。

映像内はロシア語原文＋小さな発音ルビ。ROOTの音声は出力しない。

約1秒の沈黙。ROOTの波形がわずかに揺れ、英語に戻る。

ROOT [字幕のみ]

> Sorry. No, wait. Let me put that another way.

ここでROOTの字幕表示が一瞬止まる。他の参加者は誰もロシア語に言及しない。

ORACLE

> Go ahead.

ROOT [字幕のみ]

> As I was saying, we need to distinguish memory corruption from a failure in object lifetime management.
>
> Those are related concepts, but they're not interchangeable.
>
> Without the execution trace, we cannot establish which condition actually occurred.

GHOST

> We have the same observation on our end.
>
> The available evidence doesn't establish the complete sequence of state transitions.

ZERO

> Continue.

ROOT [字幕のみ]

> Then the next step is straightforward.
>
> Separate the observable failure from the proposed explanation.
>
> Document the conditions under which the behavior is reproducible, and leave everything else unconfirmed.

会議は何事もなかったように進む。

## ACT V — Attack Surface and Evidence

04:40–06:10 · CROSS-DOMAIN REVIEW

SPECTER

> There's one comparison I want to make.
>
> On the WebKit side, we've spent years examining how complex state transitions create unexpected memory-safety failures.
>
> Browser engines and Bluetooth services are very different systems.
>
> But the methodology is transferable.

ORACLE

> Explain.

SPECTER

> Don't begin by assuming the exploit.
>
> Begin with the state machine.
>
> Identify which transitions are permitted, which transitions are forbidden, and whether the implementation preserves those constraints.

ZERO

> That applies to pointer authentication as well.
>
> PAC is a mitigation, not a proof of semantic correctness.
>
> If the system makes an invalid ownership decision, an authenticated pointer doesn't make that decision safe.

GHOST

> And Bluetooth adds another dimension.
>
> External input, pairing state, authentication restrictions, and privileged processing can all be involved.
>
> But we need to know which component actually crosses the trust boundary.

ROOT [字幕のみ]

> That's the distinction I want preserved in the final analysis.
>
> An externally reachable vulnerability is not automatically a remote code execution primitive.
>
> A memory-corruption condition is not automatically an exploitable chain.
>
> And an exploitable condition is not evidence that exploitation has occurred.

ORACLE

> Precisely.
>
> We're not here to produce a convincing theory.
>
> We're here to establish what actually happened.

約2秒の沈黙。

ZERO

> Then we need independent validation.

SPECTER

> And explicit uncertainty wherever the evidence ends.

## ACT VI — Assignment

06:10–07:15 · RESEARCH DIRECTIVES

ORACLE

> All right. Three independent research tracks.
>
> Ghost, focus on the Bluetooth and CoreUtils disclosures. Establish the documented behavior and identify the unresolved questions.
>
> Zero, examine the ARM64 memory-safety implications. I want the pointer authentication assumptions separated from the object-lifetime assumptions.
>
> Specter, prepare the WebKit comparison. Methodology only. No implied connection without evidence.

GHOST

> Understood.

ZERO

> I'll document the invariants and the conditions that would invalidate them.

SPECTER

> I'll keep the browser-side analysis independent.

ORACLE

> Root, consolidate the findings.
>
> No inferred dependencies. No unsupported vulnerability chains.
>
> If something cannot be demonstrated, mark it as unconfirmed.

ROOT [字幕のみ]

> Understood.
>
> I'll separate verified observations, working hypotheses, and unresolved contradictions.
>
> Anything without reproducible evidence stays outside the conclusions.

ORACLE

> Good.
>
> We reconvene when there's something worth examining.
>
> Until then, maintain separation between the research tracks.

## ACT VII — Termination

07:15–07:45 · SESSION CLOSED

GHOST

> Copy that.

ZERO

> Understood.

SPECTER

> I'll have the comparison ready.

ROOT [字幕のみ]

> No further observations.

ORACLE

> That's all for tonight.
>
> WISEMAN out.

会議終了。参加者のSpeaking表示が順番に消灯。

SPECTER DISCONNECTED
ZERO DISCONNECTED
GHOST DISCONNECTED
ROOT DISCONNECTED
ORACLE DISCONNECTED

SECURE SESSION TERMINATED

END OF TRANSMISSION


## 映像・音声の重要な演出指示

この脚本を実装する際の不変条件は次のとおり。

1. ROOTは全編無音。 英語もロシア語も音声を出さない。ただしSpeaking状態と波形は他の参加者と同じように変動する。
2. ロシア語の瞬間に特別な警告や効果音を出さない。 何事もなかったように表示する。
3. 他の4人はロシア語を完全に無視する。 驚きや質問、笑いなどの反応を追加しない。
4. WISEMANは匿名音声会議アプリ。 チャットアプリのようなメッセージ履歴や入力欄を追加しない。
5. 脆弱性の因果関係を創作しない。 CVE番号は制作時にAppleの公式情報と再照合する。台本上の技術的な仮説は、確認済み事実と区別する。
