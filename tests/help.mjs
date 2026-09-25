import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HELP_SECTIONS,HELP_TOPICS,helpButton,renderHelpPage} from '../js/help.js';
import {renderAnalysis} from '../js/analysisView.js';
import {renderCommunity} from '../js/communityView.js';

const topics=HELP_SECTIONS.flatMap(section=>section.topics);
assert.equal(new Set(topics.map(topic=>topic.id)).size,topics.length);
const page=renderHelpPage();
assert(page.includes('data-help-back'));
for(const topic of topics){
 assert.equal(HELP_TOPICS[topic.id],topic);
 assert(page.includes(`id="help-${topic.id}"`));
 assert(page.includes(topic.short));
 assert(helpButton(topic.id).includes(`data-help="${topic.id}"`));
 assert(helpButton(topic.id).includes('aria-expanded="false"'));
}
for(const file of ['main.js','analysisView.js','communityView.js']){
 const source=readFileSync(new URL(`../js/${file}`,import.meta.url),'utf8');
 for(const [,id] of source.matchAll(/helpButton\('([^']+)'\)/g))assert(HELP_TOPICS[id],`${file}: ${id}`);
}
const data={periods:[],events:[],decks:[],deckVersions:[],matches:[],games:[],tags:[]};
assert(renderAnalysis(data,{}).includes('data-help="analysis"'));
assert(renderCommunity({loading:false,overview:{}},true).includes('data-help="meta"'));
console.log('PASS: help page and contextual buttons share valid topics across the app');
