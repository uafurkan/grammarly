(() => {
  // ../pluma/src/engine/types.ts
  var langOf = (d) => d.startsWith("en") ? "en" : "es";
  var DIALECT_LABELS = {
    "en-US": "English (US)",
    "en-GB": "English (UK)",
    "es-ES": "Espa\xF1ol (Espa\xF1a)",
    "es-419": "Espa\xF1ol (Latinoam\xE9rica)"
  };

  // ../pluma/src/engine/rules/shared.ts
  function regexRule(id, dialects, pattern, build) {
    return {
      id,
      dialects,
      apply(text) {
        const out = [];
        const re = new RegExp(pattern.source, pattern.flags);
        let m;
        while ((m = re.exec(text)) !== null) {
          if (m[0].length === 0) {
            re.lastIndex++;
            continue;
          }
          const built = build(m);
          if (built) out.push({ begin: m.index, end: m.index + m[0].length, text: m[0], ...built });
        }
        return out;
      }
    };
  }
  function matchCase(source, target) {
    if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase();
    if (source[0] === source[0].toUpperCase()) return target[0].toUpperCase() + target.slice(1);
    return target;
  }

  // ../pluma/src/engine/data/grammar-en.ts
  var BAD_PAST = {
    goed: "went",
    buyed: "bought",
    drinked: "drank",
    eated: "ate",
    runned: "ran",
    swimmed: "swam",
    writed: "wrote",
    readed: "read",
    taked: "took",
    maked: "made",
    comed: "came",
    gived: "gave",
    knowed: "knew",
    growed: "grew",
    throwed: "threw",
    catched: "caught",
    teached: "taught",
    bringed: "brought",
    thinked: "thought",
    finded: "found",
    feeled: "felt",
    keeped: "kept",
    sleeped: "slept",
    meeted: "met",
    sayed: "said",
    payed: "paid",
    selled: "sold",
    telled: "told",
    holded: "held",
    builded: "built",
    sended: "sent",
    spended: "spent",
    leaved: "left",
    losed: "lost",
    breaked: "broke",
    choosed: "chose",
    speaked: "spoke",
    standed: "stood",
    understanded: "understood",
    winned: "won",
    beginned: "began",
    drived: "drove",
    rised: "rose",
    falled: "fell",
    flied: "flew",
    hurted: "hurt",
    putted: "put",
    cutted: "cut",
    costed: "cost",
    hitted: "hit",
    leded: "led",
    meaned: "meant",
    shaked: "shook",
    weared: "wore",
    tored: "tore",
    steeled: "stole",
    sweeped: "swept"
  };
  var BAD_PARTICIPLE = {
    went: "gone",
    took: "taken",
    came: "come",
    did: "done",
    saw: "seen",
    ate: "eaten",
    gave: "given",
    wrote: "written",
    drove: "driven",
    broke: "broken",
    spoke: "spoken",
    chose: "chosen",
    began: "begun",
    drank: "drunk",
    swam: "swum",
    rang: "rung",
    sang: "sung",
    wore: "worn",
    tore: "torn",
    stole: "stolen",
    threw: "thrown",
    grew: "grown",
    flew: "flown",
    knew: "known",
    fell: "fallen",
    rose: "risen"
  };
  var BAD_PLURAL = {
    peoples: "people",
    childs: "children",
    mans: "men",
    womans: "women",
    foots: "feet",
    tooths: "teeth",
    mouses: "mice",
    gooses: "geese",
    informations: "information",
    advices: "advice",
    knowledges: "knowledge",
    furnitures: "furniture",
    equipments: "equipment",
    researches: "research",
    homeworks: "homework",
    softwares: "software",
    staffs: "staff",
    sheeps: "sheep",
    fishs: "fish",
    criterias: "criteria",
    phenomenons: "phenomena"
  };
  var THIRD_PERSON = {
    go: "goes",
    do: "does",
    have: "has",
    be: "is",
    say: "says",
    get: "gets",
    make: "makes",
    know: "knows",
    think: "thinks",
    take: "takes",
    see: "sees",
    come: "comes",
    want: "wants",
    use: "uses",
    find: "finds",
    give: "gives",
    tell: "tells",
    work: "works",
    call: "calls",
    try: "tries",
    ask: "asks",
    need: "needs",
    feel: "feels",
    become: "becomes",
    leave: "leaves",
    put: "puts",
    mean: "means",
    keep: "keeps",
    let: "lets",
    begin: "begins",
    seem: "seems",
    help: "helps",
    talk: "talks",
    turn: "turns",
    start: "starts",
    show: "shows",
    hear: "hears",
    play: "plays",
    run: "runs",
    move: "moves",
    live: "lives",
    believe: "believes",
    bring: "brings",
    happen: "happens",
    write: "writes",
    provide: "provides",
    sit: "sits",
    stand: "stands",
    lose: "loses",
    pay: "pays",
    meet: "meets",
    include: "includes",
    continue: "continues",
    set: "sets",
    learn: "learns",
    change: "changes",
    lead: "leads",
    watch: "watches",
    follow: "follows",
    stop: "stops",
    create: "creates",
    speak: "speaks",
    read: "reads",
    spend: "spends",
    grow: "grows",
    open: "opens",
    walk: "walks",
    win: "wins",
    teach: "teaches",
    offer: "offers",
    remember: "remembers",
    consider: "considers",
    appear: "appears",
    buy: "buys",
    wait: "waits",
    serve: "serves",
    die: "dies",
    send: "sends",
    build: "builds",
    stay: "stays",
    fall: "falls",
    cut: "cuts",
    reach: "reaches",
    kill: "kills",
    raise: "raises",
    pass: "passes",
    sell: "sells",
    decide: "decides",
    return: "returns",
    explain: "explains",
    hope: "hopes",
    develop: "develops",
    carry: "carries",
    break: "breaks",
    receive: "receives",
    agree: "agrees",
    support: "supports",
    hit: "hits",
    produce: "produces",
    eat: "eats",
    cover: "covers",
    catch: "catches",
    draw: "draws",
    choose: "chooses",
    drink: "drinks",
    argue: "argues",
    like: "likes"
  };

  // ../pluma/src/engine/rules/en.ts
  var ALL_EN = ["en-US", "en-GB"];
  var repeatedWord = regexRule(
    "en.repeated-word",
    ALL_EN,
    /\b([A-Za-z']+)(\s+)\1\b/gi,
    (m) => (
      // "had had", "that that" are legitimate often enough to skip the noisiest ones
      ["had", "that", "very", "really"].includes(m[1].toLowerCase()) ? null : {
        replacements: [m[1]],
        category: "correctness",
        message: `The word \u201C${m[1]}\u201D is repeated.`
      }
    )
  );
  var doubleSpace = regexRule("en.double-space", ALL_EN, /\S {2,}\S/g, (m) => ({
    replacements: [m[0][0] + " " + m[0][m[0].length - 1]],
    category: "clarity",
    message: "Multiple spaces \u2014 one is enough."
  }));
  var AN_EXCEPTIONS = /* @__PURE__ */ new Set(["university", "unit", "united", "user", "one", "once", "european", "unique", "useful"]);
  var A_EXCEPTIONS = /* @__PURE__ */ new Set(["hour", "honest", "honor", "honour", "heir"]);
  var articleAn = regexRule("en.a-vs-an", ALL_EN, /\b(a|an) ([a-z]+)/gi, (m) => {
    const article = m[1].toLowerCase();
    const word = m[2].toLowerCase();
    const startsVowel = /^[aeiou]/.test(word);
    const wantsAn = A_EXCEPTIONS.has(word) || startsVowel && !AN_EXCEPTIONS.has(word);
    if (article === "a" && wantsAn) {
      return {
        replacements: [`an ${m[2]}`],
        category: "correctness",
        message: `Use \u201Can\u201D before a vowel sound: \u201Can ${word}\u201D.`
      };
    }
    if (article === "an" && !wantsAn) {
      return {
        replacements: [`a ${m[2]}`],
        category: "correctness",
        message: `Use \u201Ca\u201D before a consonant sound: \u201Ca ${word}\u201D.`
      };
    }
    return null;
  });
  var lonelyI = {
    id: "en.lowercase-i",
    dialects: ALL_EN,
    apply(text) {
      const out = [];
      const re = /(^|[\s(])(i)([\s,.!?;:)']|$)/gm;
      let m;
      while ((m = re.exec(text)) !== null) {
        const begin = m.index + m[1].length;
        out.push({ begin, end: begin + 1, text: "i", replacements: ["I"], category: "correctness", message: "The pronoun \u201CI\u201D is always capitalized." });
      }
      return out;
    }
  };
  var sentenceCase = {
    id: "en.sentence-capital",
    dialects: ALL_EN,
    apply(text) {
      const out = [];
      const re = /[.!?]\s+([a-z])([a-z]*)/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const begin = m.index + m[0].length - m[1].length - m[2].length;
        out.push({
          begin,
          end: begin + m[1].length,
          text: m[1],
          replacements: [m[1].toUpperCase()],
          category: "correctness",
          message: "Sentences begin with a capital letter."
        });
      }
      return out;
    }
  };
  var SV_MAP = {
    go: "goes",
    do: "does",
    have: "has",
    want: "wants",
    need: "needs",
    like: "likes",
    make: "makes",
    say: "says",
    know: "knows",
    think: "thinks",
    take: "takes",
    get: "gets",
    work: "works",
    live: "lives",
    study: "studies"
  };
  var subjectVerb = regexRule(
    "en.subject-verb",
    ALL_EN,
    /\b(he|she|it)\s+(go|do|have|want|need|like|make|say|know|think|take|get|work|live|study)\b/gi,
    (m) => {
      const verb = m[2].toLowerCase();
      const fixed = SV_MAP[verb];
      if (!fixed) return null;
      return {
        replacements: [`${m[1]} ${fixed}`],
        category: "correctness",
        message: `\u201C${m[1]}\u201D takes the third-person form: \u201C${fixed}\u201D.`
      };
    }
  );
  var COULD_OF = regexRule("en.could-of", ALL_EN, /\b(could|would|should|must|might) of\b/gi, (m) => ({
    replacements: [`${m[1]} have`],
    category: "correctness",
    message: `\u201C${m[1]} of\u201D is a mishearing of \u201C${m[1]} have\u201D.`
  }));
  var MISSPELLINGS = {
    alot: "a lot",
    definately: "definitely",
    recieve: "receive",
    seperate: "separate",
    occured: "occurred",
    untill: "until",
    wich: "which",
    becuase: "because",
    teh: "the",
    thier: "their",
    freind: "friend",
    beleive: "believe",
    enviroment: "environment",
    goverment: "government",
    tommorow: "tomorrow",
    truely: "truly",
    arguement: "argument",
    occurence: "occurrence",
    existance: "existence",
    accomodate: "accommodate",
    neccessary: "necessary",
    publically: "publicly",
    concious: "conscious",
    writting: "writing"
  };
  var misspelling = regexRule(
    "en.misspelling",
    ALL_EN,
    new RegExp(`\\b(${Object.keys(MISSPELLINGS).join("|")})\\b`, "gi"),
    (m) => {
      const fix = MISSPELLINGS[m[1].toLowerCase()];
      return {
        replacements: [matchCase(m[1], fix)],
        category: "correctness",
        message: `Possible spelling mistake \u2014 did you mean \u201C${fix}\u201D?`
      };
    }
  );
  var CONTRACTIONS = {
    dont: "don't",
    doesnt: "doesn't",
    didnt: "didn't",
    cant: "can't",
    wont: "won't",
    isnt: "isn't",
    arent: "aren't",
    wasnt: "wasn't",
    werent: "weren't",
    couldnt: "couldn't",
    wouldnt: "wouldn't",
    shouldnt: "shouldn't",
    havent: "haven't",
    hasnt: "hasn't",
    im: "I'm",
    youre: "you're",
    theyre: "they're",
    weve: "we've",
    youve: "you've"
  };
  var contraction = regexRule(
    "en.contraction-apostrophe",
    ALL_EN,
    new RegExp(`\\b(${Object.keys(CONTRACTIONS).join("|")})\\b`, "gi"),
    (m) => {
      const key = m[1].toLowerCase();
      const fix = CONTRACTIONS[key];
      return {
        replacements: [key === "im" ? "I'm" : matchCase(m[1], fix)],
        category: "correctness",
        message: `Missing apostrophe \u2014 \u201C${fix}\u201D.`
      };
    }
  );
  var yourWelcome = regexRule("en.your-youre", ALL_EN, /\byour (welcome|right about|going to|not going)\b/gi, (m) => ({
    replacements: [`you're ${m[1]}`],
    category: "correctness",
    message: `Here \u201Cyou're\u201D (you are) is intended, not the possessive \u201Cyour\u201D.`
  }));
  var itsIts = regexRule(
    "en.its-its",
    ALL_EN,
    /\bits (a|an|the|not|been|very|so|really|going|important|possible|likely|clear|true)\b/gi,
    (m) => ({
      replacements: [`it's ${m[1]}`],
      category: "correctness",
      message: `Here \u201Cit's\u201D (it is) is intended, not the possessive \u201Cits\u201D.`
    })
  );
  var UK_TO_US = {
    colour: "color",
    colours: "colors",
    favour: "favor",
    favourite: "favorite",
    behaviour: "behavior",
    honour: "honor",
    labour: "labor",
    neighbour: "neighbor",
    organise: "organize",
    organised: "organized",
    organisation: "organization",
    analyse: "analyze",
    analysed: "analyzed",
    realise: "realize",
    realised: "realized",
    recognise: "recognize",
    centre: "center",
    metre: "meter",
    litre: "liter",
    theatre: "theater",
    travelling: "traveling",
    travelled: "traveled",
    cancelled: "canceled",
    defence: "defense",
    licence: "license",
    practise: "practice",
    programme: "program",
    catalogue: "catalog",
    grey: "gray"
  };
  var US_TO_UK = Object.fromEntries(
    Object.entries(UK_TO_US).map(([uk, us]) => [us, uk])
  );
  function dialectSpelling(id, dialect2, map, label) {
    const re = new RegExp(`\\b(${Object.keys(map).join("|")})\\b`, "gi");
    return regexRule(id, [dialect2], re, (m) => {
      const fix = map[m[1].toLowerCase()];
      if (!fix) return null;
      return {
        replacements: [matchCase(m[1], fix)],
        category: "correctness",
        message: `\u201C${m[1]}\u201D is the ${label} spelling \u2014 your document is set to ${dialect2 === "en-US" ? "American" : "British"} English.`
      };
    });
  }
  var badPast = regexRule(
    "en.irregular-past",
    ALL_EN,
    new RegExp(`\\b(${Object.keys(BAD_PAST).join("|")})\\b`, "gi"),
    (m) => {
      const fix = BAD_PAST[m[1].toLowerCase()];
      return fix ? { replacements: [matchCase(m[1], fix)], category: "correctness", message: `Irregular past tense \u2014 \u201C${fix}\u201D.` } : null;
    }
  );
  var badParticiple = regexRule(
    "en.bad-participle",
    ALL_EN,
    new RegExp(`\\b(have|has|had|having)\\s+(${Object.keys(BAD_PARTICIPLE).join("|")})\\b`, "gi"),
    (m) => {
      const fix = BAD_PARTICIPLE[m[2].toLowerCase()];
      return fix ? {
        replacements: [`${m[1]} ${matchCase(m[2], fix)}`],
        category: "correctness",
        message: `After \u201C${m[1].toLowerCase()}\u201D, use the past participle \u201C${fix}\u201D.`
      } : null;
    }
  );
  var badPlural = regexRule(
    "en.irregular-plural",
    ALL_EN,
    new RegExp(`\\b(${Object.keys(BAD_PLURAL).join("|")})\\b`, "gi"),
    (m) => {
      const fix = BAD_PLURAL[m[1].toLowerCase()];
      return fix ? { replacements: [matchCase(m[1], fix)], category: "correctness", message: `\u201C${fix}\u201D is already plural (or uncountable).` } : null;
    }
  );
  var PLURAL_SUBJ = /\b(we|they|you|these|those)\s+(was)\b/gi;
  var SING_SUBJ = /\b(i|he|she|it|this|that)\s+(were)\b/gi;
  var wasWerePlural = regexRule("en.was-were-plural", ALL_EN, PLURAL_SUBJ, (m) => ({
    replacements: [`${m[1]} were`],
    category: "correctness",
    message: `\u201C${m[1].toLowerCase()}\u201D takes \u201Cwere\u201D, not \u201Cwas\u201D.`
  }));
  var wasWereSingular = regexRule("en.were-was-singular", ALL_EN, SING_SUBJ, (m) => ({
    replacements: [`${m[1]} ${m[1].toLowerCase() === "i" ? "was" : "was"}`],
    category: "correctness",
    message: `\u201C${m[1]}\u201D takes \u201Cwas\u201D, not \u201Cwere\u201D.`
  }));
  var nounWere = regexRule(
    "en.noun-were",
    ALL_EN,
    /\b(the|this|that|a|an|his|her|its|my|your|our|their)\s+([a-z]+)\s+(were)\b/gi,
    (m) => {
      const noun = m[2].toLowerCase();
      if (/s$/.test(noun) || ["people", "police", "children", "men", "women"].includes(noun)) return null;
      return {
        replacements: [`${m[1]} ${m[2]} was`],
        category: "correctness",
        message: `Singular subject \u201C${m[1]} ${m[2]}\u201D takes \u201Cwas\u201D.`
      };
    }
  );
  var verbsAlt = Object.keys(THIRD_PERSON).join("|");
  var thirdPersonS = regexRule(
    "en.third-person-s",
    ALL_EN,
    new RegExp(`\\b(he|she|it)\\s+(${verbsAlt})\\b`, "gi"),
    (m) => {
      const fix = THIRD_PERSON[m[2].toLowerCase()];
      return fix ? {
        replacements: [`${m[1]} ${matchCase(m[2], fix)}`],
        category: "correctness",
        message: `\u201C${m[1]}\u201D takes the -s form: \u201C${fix}\u201D.`
      } : null;
    }
  );
  var THIRD_TO_BASE = Object.fromEntries(
    Object.entries(THIRD_PERSON).map(([base, third]) => [third, base])
  );
  var pluralVerbAgreement = regexRule(
    "en.plural-verb",
    ALL_EN,
    new RegExp(`\\b(we|they|you|i)\\s+(${Object.values(THIRD_PERSON).join("|")})\\b`, "gi"),
    (m) => {
      const base = THIRD_TO_BASE[m[2].toLowerCase()];
      if (!base) return null;
      return {
        replacements: [`${m[1]} ${matchCase(m[2], base)}`],
        category: "correctness",
        message: `\u201C${m[1].toLowerCase()}\u201D takes the base form: \u201C${base}\u201D.`
      };
    }
  );
  var dontDoesnt = regexRule(
    "en.dont-doesnt",
    ALL_EN,
    /\b(he|she|it)\s+(don't|do not)\b/gi,
    (m) => ({
      replacements: [`${m[1]} ${m[2].toLowerCase() === "don't" ? "doesn't" : "does not"}`],
      category: "correctness",
      message: `\u201C${m[1]}\u201D takes \u201Cdoesn't\u201D, not \u201Cdon't\u201D.`
    })
  );
  var doSupportBase = regexRule(
    "en.do-support-base",
    ALL_EN,
    new RegExp(`\\b(don't|doesn't|didn't|do not|does not|did not)\\s+([a-z]+s)\\b`, "gi"),
    (m) => {
      const v = m[2].toLowerCase();
      const base = Object.entries(THIRD_PERSON).find(([, third]) => third === v)?.[0];
      if (!base) return null;
      return {
        replacements: [`${m[1]} ${matchCase(m[2], base)}`],
        category: "correctness",
        message: `After \u201C${m[1].toLowerCase()}\u201D, use the base form \u201C${base}\u201D.`
      };
    }
  );
  var PASSIVE_PARTICIPLES = [
    "written",
    "known",
    "seen",
    "done",
    "gone",
    "given",
    "taken",
    "shown",
    "made",
    "said",
    "thought",
    "brought",
    "taught",
    "bought",
    "caught",
    "felt",
    "held",
    "kept",
    "left",
    "lost",
    "sent",
    "told",
    "found",
    "led",
    "heard",
    "built",
    "broken",
    "chosen",
    "driven",
    "eaten",
    "fallen",
    "frozen",
    "hidden",
    "risen",
    "stolen",
    "thrown",
    "torn",
    "worn",
    "beaten"
  ];
  var STATIVE_ADJ = /* @__PURE__ */ new Set([
    "tired",
    "excited",
    "interested",
    "married",
    "located",
    "based",
    "named",
    "called",
    "known",
    "supposed",
    "dedicated",
    "involved",
    "related",
    "concerned"
  ]);
  var PASSIVE_PART_PAT = `(?:${PASSIVE_PARTICIPLES.join("|")}|[a-z]{4,}ed)`;
  var passiveVoice = regexRule(
    "en.passive-voice",
    ALL_EN,
    new RegExp(`\\b(am|is|are|was|were|be|been|being)\\s+(?:[a-z]+ly\\s+)?(${PASSIVE_PART_PAT})\\b`, "gi"),
    (m) => {
      if (STATIVE_ADJ.has(m[2].toLowerCase())) return null;
      return {
        replacements: [],
        category: "clarity",
        message: "Passive voice \u2014 rewrite in active voice for stronger sentences."
      };
    }
  );
  var weakIntensifier = regexRule(
    "en.weak-intensifier",
    ALL_EN,
    /\b(very|really|extremely|incredibly|absolutely|totally|literally|basically|simply|quite|rather|awfully|terribly)\s+(\w+)/gi,
    (m) => ({
      replacements: [m[2]],
      category: "clarity",
      message: `"${m[1]}" is a filler. Drop it or choose a stronger word.`
    })
  );
  var WORDY = [
    [/\bin order to\b/gi, "to", '"in order to" \u2192 "to"'],
    [/\bdue to the fact that\b/gi, "because", '"due to the fact that" \u2192 "because"'],
    [/\bat this point in time\b/gi, "now", '"at this point in time" \u2192 "now"'],
    [/\bin the event that\b/gi, "if", '"in the event that" \u2192 "if"'],
    [/\bfor the purpose of\b/gi, "to", '"for the purpose of" \u2192 "to"'],
    [/\bin spite of the fact that\b/gi, "although", '"in spite of the fact that" \u2192 "although"'],
    [/\bin the near future\b/gi, "soon", '"in the near future" \u2192 "soon"'],
    [/\bon a regular basis\b/gi, "regularly", '"on a regular basis" \u2192 "regularly"'],
    [/\bin a timely manner\b/gi, "promptly", '"in a timely manner" \u2192 "promptly"'],
    [/\bat (the present|this) time\b/gi, "currently", '\u2192 "currently"'],
    [/\ba large number of\b/gi, "many", '"a large number of" \u2192 "many"'],
    [/\bthe majority of\b/gi, "most", '"the majority of" \u2192 "most"'],
    [/\bin close proximity( to)?\b/gi, "near", '"in close proximity to" \u2192 "near"'],
    [/\bprior to\b/gi, "before", '"prior to" \u2192 "before"'],
    [/\bsubsequent to\b/gi, "after", '"subsequent to" \u2192 "after"'],
    [/\bin light of the fact that\b/gi, "since", '\u2192 "since"'],
    [/\bis able to\b/gi, "can", '"is able to" \u2192 "can"'],
    [/\bare able to\b/gi, "can", '"are able to" \u2192 "can"'],
    [/\bmake a decision\b/gi, "decide", '"make a decision" \u2192 "decide"'],
    [/\bmake a choice\b/gi, "choose", '"make a choice" \u2192 "choose"'],
    [/\btake into consideration\b/gi, "consider", '\u2192 "consider"'],
    [/\bprovide assistance\b/gi, "help", '"provide assistance" \u2192 "help"'],
    [/\bmake an attempt\b/gi, "try", '"make an attempt" \u2192 "try"'],
    [/\b(utilise|utilize)\b/gi, "use", '"utilize" \u2192 "use"'],
    [/\b(endeavour|endeavor)\b/gi, "try", '"endeavor" \u2192 "try"'],
    [/\bcommence\b/gi, "start", '"commence" \u2192 "start"'],
    [/\bfacilitate\b/gi, "help or enable", '"facilitate" \u2192 "help"'],
    [/\bascertain\b/gi, "find out", '"ascertain" \u2192 "find out"']
  ];
  var wordyRules = WORDY.map(
    ([re, fix, msg], i) => regexRule(`en.wordy-${i}`, ALL_EN, re, () => ({
      replacements: [fix],
      category: "clarity",
      message: `Wordy phrase \u2014 ${msg}.`
    }))
  );
  var hedging = regexRule(
    "en.hedging",
    ALL_EN,
    /\b(i think that |i believe that |i feel that |in my opinion[,]? |sort of |kind of )/gi,
    () => ({
      replacements: [],
      category: "clarity",
      message: "Hedging phrase weakens your point. State it directly."
    })
  );
  var longSentence = {
    id: "en.long-sentence",
    dialects: ALL_EN,
    apply(text) {
      const out = [];
      const re = /[^.!?]+[.!?]/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const words = m[0].trim().split(/\s+/).length;
        if (words > 45) {
          out.push({
            begin: m.index,
            end: m.index + m[0].length,
            text: m[0].trim().slice(0, 60) + "\u2026",
            replacements: [],
            category: "clarity",
            message: `Long sentence (${words} words). Consider splitting it.`
          });
        }
      }
      return out;
    }
  };
  var EN_RULES = [
    repeatedWord,
    doubleSpace,
    articleAn,
    lonelyI,
    sentenceCase,
    subjectVerb,
    thirdPersonS,
    pluralVerbAgreement,
    dontDoesnt,
    doSupportBase,
    badPast,
    badParticiple,
    badPlural,
    wasWerePlural,
    wasWereSingular,
    nounWere,
    COULD_OF,
    misspelling,
    contraction,
    yourWelcome,
    itsIts,
    passiveVoice,
    weakIntensifier,
    ...wordyRules,
    hedging,
    longSentence,
    dialectSpelling("en.us-spelling", "en-US", UK_TO_US, "British"),
    dialectSpelling("en.uk-spelling", "en-GB", US_TO_UK, "American")
  ];

  // ../pluma/src/engine/rules/es.ts
  var ALL_ES = ["es-ES", "es-419"];
  var W = "A-Za-z\xC1\xC9\xCD\xD3\xDA\xDC\xD1\xE1\xE9\xED\xF3\xFA\xFC\xF1";
  var repeatedWord2 = regexRule(
    "es.repeated-word",
    ALL_ES,
    new RegExp(`\\b([${W}]+)(\\s+)\\1\\b`, "gi"),
    (m) => ({
      replacements: [m[1]],
      category: "correctness",
      message: `La palabra \xAB${m[1]}\xBB est\xE1 repetida.`
    })
  );
  var doubleSpace2 = regexRule("es.double-space", ALL_ES, /(?<=\S) {2,}(?=\S)/g, () => ({
    replacements: [" "],
    category: "clarity",
    message: "Hay espacios de m\xE1s \u2014 con uno basta."
  }));
  var ACCENTS = {
    tambien: "tambi\xE9n",
    despues: "despu\xE9s",
    aqui: "aqu\xED",
    alli: "all\xED",
    ademas: "adem\xE1s",
    facil: "f\xE1cil",
    dificil: "dif\xEDcil",
    ultimo: "\xFAltimo",
    ultima: "\xFAltima",
    proximo: "pr\xF3ximo",
    proxima: "pr\xF3xima",
    dias: "d\xEDas",
    adios: "adi\xF3s",
    cafe: "caf\xE9",
    corazon: "coraz\xF3n",
    cancion: "canci\xF3n",
    atencion: "atenci\xF3n",
    informacion: "informaci\xF3n",
    educacion: "educaci\xF3n",
    investigacion: "investigaci\xF3n",
    conclusion: "conclusi\xF3n",
    introduccion: "introducci\xF3n",
    analisis: "an\xE1lisis",
    titulo: "t\xEDtulo",
    parrafo: "p\xE1rrafo",
    pagina: "p\xE1gina",
    numero: "n\xFAmero",
    telefono: "tel\xE9fono",
    miercoles: "mi\xE9rcoles",
    sabado: "s\xE1bado",
    ingles: "ingl\xE9s",
    espanol: "espa\xF1ol",
    rapido: "r\xE1pido",
    practico: "pr\xE1ctico",
    academico: "acad\xE9mico",
    academica: "acad\xE9mica",
    basico: "b\xE1sico",
    critica: "cr\xEDtica",
    metodologia: "metodolog\xEDa",
    bibliografia: "bibliograf\xEDa",
    economia: "econom\xEDa"
  };
  var missingAccent = regexRule(
    "es.missing-accent",
    ALL_ES,
    new RegExp(`\\b(${Object.keys(ACCENTS).join("|")})\\b`, "gi"),
    (m) => {
      const fix = ACCENTS[m[1].toLowerCase()];
      return {
        replacements: [matchCase(m[1], fix)],
        category: "correctness",
        message: `Falta la tilde: \xAB${fix}\xBB.`
      };
    }
  );
  var MISSPELLINGS_ES = {
    hechar: ["echar", "\xABEchar\xBB se escribe sin h."],
    haci: ["as\xED", "Se escribe \xABas\xED\xBB."],
    nesecito: ["necesito", "Se escribe \xABnecesito\xBB."],
    dijistes: ["dijiste", "El pret\xE9rito de segunda persona no lleva -s final."],
    fuistes: ["fuiste", "El pret\xE9rito de segunda persona no lleva -s final."],
    "haber si": ["a ver si", "Aqu\xED corresponde \xABa ver\xBB (mirar), no el verbo \xABhaber\xBB."],
    "iva a": ["iba a", "El imperfecto de \xABir\xBB se escribe con b: \xABiba\xBB."],
    "mas sin embargo": ["sin embargo", "\xABMas sin embargo\xBB es redundante."]
  };
  var misspellingEs = regexRule(
    "es.misspelling",
    ALL_ES,
    new RegExp(`\\b(${Object.keys(MISSPELLINGS_ES).join("|")})\\b`, "gi"),
    (m) => {
      const entry = MISSPELLINGS_ES[m[1].toLowerCase()];
      if (!entry) return null;
      return {
        replacements: [matchCase(m[1], entry[0])],
        category: "correctness",
        message: entry[1]
      };
    }
  );
  var porqueQuestion = regexRule(
    "es.porque-question",
    ALL_ES,
    /¿([^?¿]*)\bporque\b/gi,
    (m) => ({
      replacements: [m[0].replace(/porque/i, "por qu\xE9")],
      category: "correctness",
      message: "En preguntas directas se escribe \xABpor qu\xE9\xBB (separado y con tilde)."
    })
  );
  function invertedMark(id, close, open, label) {
    return {
      id,
      dialects: ALL_ES,
      apply(text) {
        const out = [];
        const re = close === "?" ? /[^.!?¿\n][^.!?\n]*\?/g : /[^.!?¡\n][^.!?\n]*!/g;
        let m;
        while ((m = re.exec(text)) !== null) {
          const sentence = m[0];
          if (sentence.includes(open)) continue;
          const lead = sentence.length - sentence.trimStart().length;
          const begin = m.index + lead;
          const flagged = sentence.slice(lead);
          out.push({
            begin,
            end: begin + flagged.length,
            text: flagged,
            replacements: [open + flagged],
            category: "correctness",
            message: `Las ${label} en espa\xF1ol llevan signo de apertura: \xAB${open}\u2026${close}\xBB.`
          });
        }
        return out;
      }
    };
  }
  var vosotrosIn419 = regexRule(
    "es.419-vosotros",
    ["es-419"],
    /\b(vosotros|vosotras|vuestro|vuestra|vuestros|vuestras|os\b(?=\s))\b/gi,
    (m) => ({
      replacements: m[1].toLowerCase().startsWith("vosotr") ? ["ustedes"] : [],
      category: "clarity",
      message: `\xAB${m[1]}\xBB es propio del espa\xF1ol peninsular; en Latinoam\xE9rica se usa \xABustedes\xBB y sus formas.`
    })
  );
  var voseoInES = regexRule(
    "es.es-voseo",
    ["es-ES"],
    /\bvos (sos|tenés|querés|podés|sabés|hacés|decís)\b/gi,
    (m) => ({
      replacements: [],
      category: "clarity",
      message: `El voseo (\xABvos ${m[1]}\xBB) es propio de partes de Latinoam\xE9rica; en Espa\xF1a se usa \xABt\xFA eres / tienes\u2026\xBB.`
    })
  );
  var VERB_ERRORS = {
    haiga: ["haya", "La forma correcta del subjuntivo es \xABhaya\xBB."],
    haigan: ["hayan", "La forma correcta es \xABhayan\xBB."],
    vinistes: ["viniste", "El pret\xE9rito de segunda persona no lleva -s final."],
    hicistes: ["hiciste", "El pret\xE9rito de segunda persona no lleva -s final."],
    pusistes: ["pusiste", "El pret\xE9rito de segunda persona no lleva -s final."],
    cocreto: ["concreto", "Se escribe \xABconcreto\xBB."],
    dentrar: ["entrar", "El verbo es \xABentrar\xBB, no \xABdentrar\xBB."],
    diferiencia: ["diferencia", "Se escribe \xABdiferencia\xBB."]
  };
  var verbErrorsEs = regexRule(
    "es.verb-errors",
    ALL_ES,
    new RegExp(`\\b(${Object.keys(VERB_ERRORS).join("|")})\\b`, "gi"),
    (m) => {
      const e = VERB_ERRORS[m[1].toLowerCase()];
      return e ? { replacements: [matchCase(m[1], e[0])], category: "correctness", message: e[1] } : null;
    }
  );
  var GENDER = {
    "la problema": "el problema",
    "el mano": "la mano",
    "la mapa": "el mapa",
    "el agua": "el agua",
    // correct (el for stressed á), keep as no-op guard
    "la tema": "el tema",
    "el foto": "la foto",
    "la d\xEDa": "el d\xEDa",
    "el gente": "la gente"
  };
  var genderEs = regexRule(
    "es.gender-agreement",
    ALL_ES,
    /\b(el|la)\s+(problema|mano|mapa|tema|foto|día|gente)\b/gi,
    (m) => {
      const phrase = `${m[1].toLowerCase()} ${m[2].toLowerCase()}`;
      const fix = GENDER[phrase];
      if (!fix || fix === phrase) return null;
      return {
        replacements: [matchCase(m[0], fix)],
        category: "correctness",
        message: `Concordancia de g\xE9nero: \xAB${fix}\xBB.`
      };
    }
  );
  var ES_RULES = [
    repeatedWord2,
    doubleSpace2,
    missingAccent,
    misspellingEs,
    verbErrorsEs,
    genderEs,
    porqueQuestion,
    invertedMark("es.opening-question", "?", "\xBF", "preguntas"),
    invertedMark("es.opening-exclamation", "!", "\xA1", "exclamaciones"),
    vosotrosIn419,
    voseoInES
  ];

  // ../pluma/src/engine/run.ts
  var MAX_ALERTS = 250;
  var counter = 0;
  function runRules(text, dialect2, policy) {
    const rules = (langOf(dialect2) === "en" ? EN_RULES : ES_RULES).filter(
      (r) => r.dialects.includes(dialect2)
    );
    const out = [];
    for (const rule of rules) {
      if (policy?.suppress(rule.id)) continue;
      for (const m of rule.apply(text, dialect2)) out.push({ ...m, ruleId: rule.id });
    }
    return out;
  }
  function resolveOverlaps(matches, policy) {
    const bySize = [...matches].sort((a, b) => a.end - a.begin - (b.end - b.begin));
    const kept = [];
    for (const a of bySize) {
      if (kept.some((k) => a.begin < k.end && k.begin < a.end)) continue;
      kept.push(a);
    }
    let capped = kept;
    if (kept.length > MAX_ALERTS) {
      capped = policy ? [...kept].sort((a, b) => policy.weightFor(b.ruleId, b.category) - policy.weightFor(a.ruleId, a.category)).slice(0, MAX_ALERTS) : kept.slice(0, MAX_ALERTS);
    }
    return capped.sort((a, b) => a.begin - b.begin || a.end - b.end).map((m) => ({ id: `a${++counter}`, ...m }));
  }

  // ../pluma/src/engine/goals.ts
  var DEFAULT_GOALS = {
    audience: "general",
    formality: "neutral",
    domain: "general",
    intent: "inform"
  };
  function familyOf(ruleId) {
    if (ruleId.endsWith(".spelling")) return "spelling";
    if (/passive/.test(ruleId)) return "passive";
    if (/intensifier/.test(ruleId)) return "intensifier";
    if (/wordy/.test(ruleId)) return "wordy";
    if (/hedg/.test(ruleId)) return "hedging";
    if (/long-sentence/.test(ruleId)) return "longsentence";
    return "other";
  }
  function policyFor(goals) {
    return {
      suppress(ruleId) {
        const fam = familyOf(ruleId);
        if (fam === "spelling" || fam === "other") return false;
        if (goals.domain === "creative" && (fam === "passive" || fam === "longsentence" || fam === "intensifier")) return true;
        if (goals.intent === "tell-story" && (fam === "passive" || fam === "longsentence")) return true;
        if (goals.formality === "informal" && fam === "hedging") return true;
        if (goals.audience === "expert" && fam === "longsentence") return true;
        return false;
      },
      weightFor(ruleId, category) {
        if (category === "correctness") return 3;
        const fam = familyOf(ruleId);
        let w = 1;
        if ((goals.domain === "academic" || goals.domain === "business" || goals.domain === "email") && (fam === "wordy" || fam === "intensifier")) w += 1;
        if (goals.formality === "formal" && (fam === "hedging" || fam === "wordy")) w += 1;
        if (goals.intent === "convince" && fam === "hedging") w += 1;
        return w;
      }
    };
  }

  // src/checker.ts
  function check(text, dialect2, goals = DEFAULT_GOALS) {
    const policy = policyFor(goals);
    return resolveOverlaps(runRules(text, dialect2, policy), policy);
  }

  // src/content.ts
  var DEBOUNCE_MS = 600;
  var MIN_CHARS = 8;
  var dialect = "en-US";
  var activeField = null;
  var lastText = "";
  var alerts = [];
  var dismissed = /* @__PURE__ */ new Set();
  var debounceTimer;
  var badge = null;
  var panel = null;
  chrome.storage?.local.get(["dialect"], (r) => {
    if (r?.dialect && r.dialect in DIALECT_LABELS) dialect = r.dialect;
    if (activeField) scheduleCheck();
  });
  chrome.storage?.onChanged.addListener((changes) => {
    if (changes.dialect?.newValue) {
      dialect = changes.dialect.newValue;
      lastText = "";
      if (activeField) scheduleCheck();
    }
  });
  function isEditable(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest(".pluma-x")) return false;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
      const t = (el.type || "text").toLowerCase();
      return ["text", "search", "email", "url"].includes(t) && !el.readOnly && !el.disabled;
    }
    return el.isContentEditable;
  }
  document.addEventListener(
    "focusin",
    (e) => {
      if (isEditable(e.target)) attach(e.target);
    },
    true
  );
  document.addEventListener(
    "focusout",
    (e) => {
      if (e.target === activeField) {
        window.setTimeout(() => {
          const a = document.activeElement;
          if (a && a.closest && a.closest(".pluma-x")) return;
          if (document.activeElement !== activeField) detach();
        }, 0);
      }
    },
    true
  );
  function attach(field) {
    if (activeField === field) return;
    detach();
    activeField = field;
    field.addEventListener("input", scheduleCheck);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    scheduleCheck();
  }
  function detach() {
    if (activeField) activeField.removeEventListener("input", scheduleCheck);
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
    activeField = null;
    alerts = [];
    lastText = "";
    closePanel();
    removeBadge();
  }
  var BLOCK = /^(DIV|P|LI|UL|OL|BLOCKQUOTE|H[1-6]|TR|SECTION|ARTICLE|PRE|FIGURE|FIGCAPTION)$/;
  function readField(field) {
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      return { text: field.value, segs: null };
    }
    const segs = [];
    let text = "";
    const walk = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const t = child.nodeValue || "";
          if (t) {
            segs.push({ from: text.length, to: text.length + t.length, node: child });
            text += t;
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName;
          if (tag === "BR") {
            text += "\n";
          } else {
            walk(child);
            if (BLOCK.test(tag) && text.length > 0 && !text.endsWith("\n")) text += "\n";
          }
        }
      });
    };
    walk(field);
    return { text, segs };
  }
  function scheduleCheck() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runCheck, DEBOUNCE_MS);
  }
  function runCheck() {
    if (!activeField) return;
    const { text } = readField(activeField);
    lastText = text;
    if (text.trim().length < MIN_CHARS) {
      alerts = [];
      renderBadge();
      return;
    }
    alerts = check(text, dialect).filter((a) => !dismissed.has(fp(a)));
    renderBadge();
    if (panel) renderPanel();
  }
  var fp = (a) => `${a.ruleId}:${a.text}:${a.begin}`;
  function fieldRect() {
    if (!activeField) return null;
    return activeField.getBoundingClientRect();
  }
  function renderBadge() {
    const r = fieldRect();
    if (!r || r.width === 0 || r.height === 0) return removeBadge();
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "pluma-x pluma-badge";
      badge.addEventListener("mousedown", (e) => e.preventDefault());
      badge.addEventListener("click", togglePanel);
      document.body.appendChild(badge);
    }
    const n = alerts.length;
    badge.classList.toggle("pluma-badge--clean", n === 0);
    badge.textContent = n === 0 ? "\u2713" : String(n);
    badge.title = n === 0 ? "Pluma \u2014 looks clean" : `Pluma \u2014 ${n} suggestion${n > 1 ? "s" : ""}`;
    positionBadge(r);
  }
  function positionBadge(r) {
    if (!badge) return;
    const size = 22;
    badge.style.left = `${Math.min(r.right, window.innerWidth) - size - 6}px`;
    badge.style.top = `${Math.min(r.bottom, window.innerHeight) - size - 6}px`;
  }
  function removeBadge() {
    badge?.remove();
    badge = null;
  }
  function reposition() {
    const r = fieldRect();
    if (!r) return;
    positionBadge(r);
    if (panel) positionPanel(r);
  }
  function togglePanel() {
    if (panel) closePanel();
    else openPanel();
  }
  function openPanel() {
    panel = document.createElement("div");
    panel.className = "pluma-x pluma-panel";
    panel.addEventListener("mousedown", (e) => e.preventDefault());
    document.body.appendChild(panel);
    renderPanel();
    const r = fieldRect();
    if (r) positionPanel(r);
    document.addEventListener("mousedown", onDocDown, true);
  }
  function closePanel() {
    panel?.remove();
    panel = null;
    document.removeEventListener("mousedown", onDocDown, true);
  }
  function onDocDown(e) {
    const t = e.target;
    if (t.closest(".pluma-x")) return;
    closePanel();
  }
  function positionPanel(r) {
    if (!panel) return;
    const w = 320;
    const h = panel.offsetHeight || 240;
    let left = Math.min(r.right, window.innerWidth) - w;
    if (left < 8) left = 8;
    let top = Math.min(r.bottom, window.innerHeight) + 6;
    if (top + h + 8 > window.innerHeight) top = Math.max(8, r.top - h - 6);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${w}px`;
  }
  function renderPanel() {
    if (!panel) return;
    panel.innerHTML = "";
    const head = document.createElement("div");
    head.className = "pluma-head";
    head.innerHTML = `<span class="pluma-logo">Plu<em>ma</em></span>`;
    const sel = document.createElement("select");
    sel.className = "pluma-dialect";
    for (const [v, label] of Object.entries(DIALECT_LABELS)) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      if (v === dialect) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => {
      dialect = sel.value;
      chrome.storage?.local.set({ dialect });
      lastText = "";
      runCheck();
    });
    head.appendChild(sel);
    panel.appendChild(head);
    if (alerts.length === 0) {
      const clean = document.createElement("div");
      clean.className = "pluma-clean";
      clean.textContent = "\u2713 Nothing to flag.";
      panel.appendChild(clean);
      return;
    }
    const list = document.createElement("div");
    list.className = "pluma-list";
    alerts.forEach((a) => list.appendChild(card(a)));
    panel.appendChild(list);
  }
  function card(a) {
    const el = document.createElement("div");
    el.className = "pluma-card";
    const rep = a.replacements[0];
    el.innerHTML = `
    <div class="pluma-cat"><span class="pluma-dot pluma-dot--${a.category}"></span>${a.category}</div>
    <div class="pluma-change"><span class="pluma-from">${esc(a.text)}</span>${rep !== void 0 ? ` \u2192 <span class="pluma-to">${esc(rep)}</span>` : ""}</div>
    <div class="pluma-msg">${esc(a.message)}</div>`;
    const row = document.createElement("div");
    row.className = "pluma-actions";
    if (rep !== void 0) {
      const accept = btn("Accept", "pluma-accept", () => applyFix(a, 0));
      row.appendChild(accept);
    }
    row.appendChild(
      btn("Dismiss", "pluma-dismiss", () => {
        dismissed.add(fp(a));
        alerts = alerts.filter((x) => x !== a);
        renderBadge();
        renderPanel();
      })
    );
    el.appendChild(row);
    return el;
  }
  function btn(label, cls, onClick) {
    const b = document.createElement("button");
    b.className = `pluma-btn ${cls}`;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }
  function applyFix(a, index) {
    const field = activeField;
    const replacement = a.replacements[index];
    if (!field || replacement === void 0) return;
    const { text, segs } = readField(field);
    if (text.slice(a.begin, a.end) !== a.text) {
      runCheck();
      return;
    }
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      const next = text.slice(0, a.begin) + replacement + text.slice(a.end);
      setNativeValue(field, next);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (segs) {
      const start = resolveOffset(segs, a.begin);
      const end = resolveOffset(segs, a.end);
      if (!start || !end) return;
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      range.deleteContents();
      range.insertNode(document.createTextNode(replacement));
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    window.setTimeout(runCheck, 0);
  }
  function resolveOffset(segs, offset) {
    for (const s of segs) {
      if (offset >= s.from && offset <= s.to) return { node: s.node, offset: offset - s.from };
    }
    const last = segs[segs.length - 1];
    return last ? { node: last.node, offset: last.node.length } : null;
  }
  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(el, value);
    else el.value = value;
  }
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
