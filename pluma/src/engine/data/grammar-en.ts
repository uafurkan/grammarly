// Morphology tables for the English grammar rules. Kept as data so the rules
// themselves stay small and the coverage can grow without touching logic.

// Over-regularised irregular past tenses: "goed" → "went".
export const BAD_PAST: Record<string, string> = {
  goed: 'went', buyed: 'bought', drinked: 'drank', eated: 'ate', runned: 'ran',
  swimmed: 'swam', writed: 'wrote', readed: 'read', taked: 'took', maked: 'made',
  comed: 'came', gived: 'gave', knowed: 'knew', growed: 'grew', throwed: 'threw',
  catched: 'caught', teached: 'taught', bringed: 'brought', thinked: 'thought',
  finded: 'found', feeled: 'felt', keeped: 'kept', sleeped: 'slept', meeted: 'met',
  sayed: 'said', payed: 'paid', selled: 'sold', telled: 'told', holded: 'held',
  builded: 'built', sended: 'sent', spended: 'spent', leaved: 'left', losed: 'lost',
  breaked: 'broke', choosed: 'chose', speaked: 'spoke', standed: 'stood',
  understanded: 'understood', winned: 'won', beginned: 'began', drived: 'drove',
  rised: 'rose', falled: 'fell', flied: 'flew', hurted: 'hurt', putted: 'put',
  cutted: 'cut', costed: 'cost', hitted: 'hit', leded: 'led', meaned: 'meant',
  shaked: 'shook', weared: 'wore', tored: 'tore', steeled: 'stole', sweeped: 'swept',
}

// Bad past participles after have/has/had: "have went" → "have gone".
export const BAD_PARTICIPLE: Record<string, string> = {
  went: 'gone', took: 'taken', came: 'come', did: 'done', saw: 'seen', ate: 'eaten',
  gave: 'given', wrote: 'written', drove: 'driven', broke: 'broken', spoke: 'spoken',
  chose: 'chosen', began: 'begun', drank: 'drunk', swam: 'swum', rang: 'rung',
  sang: 'sung', wore: 'worn', tore: 'torn', stole: 'stolen', threw: 'thrown',
  grew: 'grown', flew: 'flown', knew: 'known', fell: 'fallen', rose: 'risen',
}

// Irregular plurals written with -s: "peoples" → "people".
export const BAD_PLURAL: Record<string, string> = {
  peoples: 'people', childs: 'children', mans: 'men', womans: 'women',
  foots: 'feet', tooths: 'teeth', mouses: 'mice', gooses: 'geese',
  informations: 'information', advices: 'advice', knowledges: 'knowledge',
  furnitures: 'furniture', equipments: 'equipment', researches: 'research',
  homeworks: 'homework', softwares: 'software', staffs: 'staff', sheeps: 'sheep',
  fishs: 'fish', criterias: 'criteria', phenomenons: 'phenomena',
}

// Base form → third-person singular present: "he go" → "he goes".
export const THIRD_PERSON: Record<string, string> = {
  go: 'goes', do: 'does', have: 'has', be: 'is', say: 'says', get: 'gets',
  make: 'makes', know: 'knows', think: 'thinks', take: 'takes', see: 'sees',
  come: 'comes', want: 'wants', use: 'uses', find: 'finds', give: 'gives',
  tell: 'tells', work: 'works', call: 'calls', try: 'tries', ask: 'asks',
  need: 'needs', feel: 'feels', become: 'becomes', leave: 'leaves', put: 'puts',
  mean: 'means', keep: 'keeps', let: 'lets', begin: 'begins', seem: 'seems',
  help: 'helps', talk: 'talks', turn: 'turns', start: 'starts', show: 'shows',
  hear: 'hears', play: 'plays', run: 'runs', move: 'moves', live: 'lives',
  believe: 'believes', bring: 'brings', happen: 'happens', write: 'writes',
  provide: 'provides', sit: 'sits', stand: 'stands', lose: 'loses', pay: 'pays',
  meet: 'meets', include: 'includes', continue: 'continues', set: 'sets',
  learn: 'learns', change: 'changes', lead: 'leads', watch: 'watches',
  follow: 'follows', stop: 'stops', create: 'creates', speak: 'speaks',
  read: 'reads', spend: 'spends', grow: 'grows', open: 'opens', walk: 'walks',
  win: 'wins', teach: 'teaches', offer: 'offers', remember: 'remembers',
  consider: 'considers', appear: 'appears', buy: 'buys', wait: 'waits',
  serve: 'serves', die: 'dies', send: 'sends', build: 'builds', stay: 'stays',
  fall: 'falls', cut: 'cuts', reach: 'reaches', kill: 'kills', raise: 'raises',
  pass: 'passes', sell: 'sells', decide: 'decides', return: 'returns',
  explain: 'explains', hope: 'hopes', develop: 'develops', carry: 'carries',
  break: 'breaks', receive: 'receives', agree: 'agrees', support: 'supports',
  hit: 'hits', produce: 'produces', eat: 'eats', cover: 'covers', catch: 'catches',
  draw: 'draws', choose: 'chooses', drink: 'drinks', argue: 'argues', like: 'likes',
}

export const SUBJECT_PRONOUNS_3SG = ['he', 'she', 'it']
export const SUBJECT_PRONOUNS_PL = ['we', 'they', 'you']
