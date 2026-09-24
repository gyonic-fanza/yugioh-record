export const normalizedDeckName=name=>String(name||'').trim().normalize('NFKC').toLocaleLowerCase('ja');
export const matchingDecks=(decks,name)=>decks.filter(deck=>normalizedDeckName(deck.name)===normalizedDeckName(name));
export const sortedDecks=decks=>[...decks].sort((a,b)=>a.name.normalize('NFKC').localeCompare(b.name.normalize('NFKC'),'ja')||a.id.localeCompare(b.id));
export const versionsForDeck=(versions,deckId)=>versions.filter(v=>v.deckId===deckId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
