const approvedDirections = {
  'S001-U018': {
    text: "Yeah. Hang on. We don't have enough to call it one chain.",
    direction: 'Sound like you are on a private call. Give one brief, quiet throat clear before answering, then respond promptly in a low, matter-of-fact tone.',
  },
  'S001-U019': {
    text: "Right. It's the same—sorry, no. One's about how long the object stays alive. The other's about what the system trusts.",
    direction: 'Take one audible breath before starting. Break off mid-thought at the dash, then correct yourself immediately in a quieter, conversational voice. Keep the second half precise.',
  },
  'S001-U021': {
    text: "Wait, can I jump in? Bluetooth and WebKit are different entry points. We should keep those separate for now.",
    direction: 'Start with the quick energy of someone entering just before the other speaker finishes. Settle into an easy, conversational rhythm after the question.',
    overlapMs: 250,
  },
  'S001-U025': {
    text: "Yeah. Good. Let's keep that distinction clear.",
    direction: 'Respond to the group with understated agreement. Leave a short beat after Good, then give the instruction simply and decisively.',
  },
}

const delivery = {
  ORACLE: 'Sound like a low-key chair in a real call. Make short acknowledgments casual. Put weight on the decision and let minor words pass quickly.',
  GHOST: 'Speak directly to colleagues in a dry, grounded lower register. Deliver short replies promptly. Say identifiers carefully, then relax back into conversational rhythm.',
  ZERO: 'Think aloud as you speak. Vary clause length and stress. Briefly hesitate when qualifying a claim, then finish the thought clearly.',
  SPECTER: 'Sound engaged and responsive. Pick up quickly when reacting to someone, then slow slightly on the distinction you want them to hear.',
}

const edits = {
  1: ["Well. It's been a while since we used the WISEMAN name.", 'Take a quiet breath before Well. Let the recognition register for a beat.'],
  2: ["We've all been doing our own thing. I think it's time we brought that work back together."],
  3: ["Let's keep this short. Stick to what we can back up."],
  4: ["If we're guessing, say so."],
  6: ["Yeah, good to hear you all. I went through Apple's latest disclosures. A couple of things stood out."],
  7: ["I've been looking at the ARM64 side. Uh, mostly pointer authentication and how long the objects are supposed to stay alive."],
  8: ["I've been on the browser side. Different surface, but I keep running into some of the same questions."],
  10: ["Okay. Ghost, take us through Bluetooth."],
  11: ["Bluetooth was the one that caught my eye."],
  13: ["So, three separate issues. Could be three different failure modes."],
  14: ["Do we have anything that actually links them?"],
  15: ["No. Nothing I'd put in a report yet."],
  26: ["On ARM64, there's another wrinkle. Pointer authentication."],
  28: ["You can have a perfectly authenticated pointer to an object that's already gone."],
  29: ["Right. The pointer can check out.", 'Come in quickly, in agreement with the last clause.', 180],
  30: ["What I want to know is whether the component still owns the object when it touches it."],
  33: ["I should be clear. That's a parallel in the reasoning. We don't know if the root cause is the same."],
  34: ["Okay, so what would tell us it's an ownership problem? What would we actually see?"],
  35: ["We'd need to see it repeat."],
  39: ["Yeah, one crash report only gets you so far."],
  41: ["All right. Let's start with what we can actually observe."],
  48: ["Mm-hm. Go ahead.", 'Quiet and neutral. Keep the existing pause and show no reaction to the preceding language change.'],
  52: ["Yeah, we're seeing the same thing on our end."],
  54: ["Okay. Keep going."],
  58: ["There's one comparison I'd like to make.", 'Take a brief audible breath before the line, then speak lightly.'],
  62: ["Go on."],
  64: ["I'd start with the state machine."],
  66: ["Yeah, same question with pointer authentication.", 'Enter quickly as the previous speaker finishes. Sound engaged, without raising your voice.', 180],
  67: ["PAC helps. It doesn't tell you the ownership decision was right."],
  69: ["Bluetooth has another piece to it, though."],
  76: ["Right."],
  77: ["It's easy to make the pieces sound like they fit."],
  79: ["Then we'll need someone to check it independently."],
  80: ["And say where we ran out of evidence."],
  81: ["All right. Three tracks. Keep them independent.", 'Pause briefly after All right, as if checking your notes.'],
  85: ["Yep. I'll take that."],
  86: ["I'll write down what has to hold, and what would make me change my mind."],
  87: ["I'll keep the browser comparison separate."],
  94: ["Okay. Good."],
  97: ["Got it."],
  98: ["Yep."],
  101: ["All right. That's enough for tonight.", 'Ease the pace as the conversation winds down.'],
  102: ["WISEMAN out.", 'Quiet and matter-of-fact. No announcer delivery.'],
}

export function performanceFor(cue) {
  if (cue.speaker === 'ROOT' && cue.en) {
    const words = cue.en.trim().split(/\s+/).length
    return { ...cue, extraHoldMs: 320 + words * 95 }
  }
  if (!cue.audioAssetId) return cue
  const approved = approvedDirections[cue.id]
  const [en, beat, overlapMs] = edits[cue.order] ?? []
  return {
    ...cue,
    en: approved?.text ?? en ?? cue.en,
    direction: approved?.direction ?? [delivery[cue.speaker], beat,
      'Use natural reductions and uneven emphasis, as in an unscripted call. Speak only the line; any breath or throat clear should be a sound, never spoken stage directions.',
    ].filter(Boolean).join(' '),
    overlapMs: approved?.overlapMs ?? overlapMs,
  }
}
