import assert from 'node:assert/strict';
import {parseDeckTextItems,suggestedDeckName} from '../js/pdfImport.js';
import {formatCards} from '../js/cardTypes.js';
import {parseCards} from '../js/services.js';
const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y],width:String(str).length*8});
const items=[item('メインデッキ合計>>>',101,723),item('3',220,723),
item('モンスターカード',108,707),item('枚数',217,707),item('魔法カード',290,707),item('枚数',387,707),item('罠カード',464,707),item('枚数',557,707),
item('灰流うらら',70,696),item('1',223,692),item('烙印融合',240,696),item('1',393,692),item('無限泡影',410,696),item('1',563,692),
item('モンスターカード合計>>>',93,273),item('1',221,273),item('魔法カード合計>>>',275,273),item('1',391,273),item('罠カード合計>>>',449,273),item('1',563,273),
item('エクストラデッキ',108,249),item('枚数',217,249),item('サイドデッキ',286,249),item('枚数',387,249),
item('氷剣竜ミラジェイド',70,238),item('1',223,235),item('宇宙的ハリケーン',240,238),item('1',393,235),
item('エクストラデッキ合計>>>',93,25),item('1',221,25),item('サイドデッキ合計>>>',271,25),item('1',391,25)];
const parsed=parseDeckTextItems(items);assert.deepEqual(parsed.totals,{main:3,extra:1,side:1});assert.equal(parsed.cards.main[1].name,'烙印融合');assert.equal(parsed.cards.side[0].name,'宇宙的ハリケーン');assert.deepEqual(parsed.cards.main.map(c=>c.type),['MONSTER','SPELL','TRAP']);assert.equal(parsed.cards.extra[0].type,'MONSTER');assert.equal(parsed.cards.side[0].type,'UNKNOWN');assert.deepEqual(parseCards(formatCards(parsed.cards.main)).map(x=>[x.name,x.count]),parsed.cards.main.map(x=>[x.name,x.count]));assert(parsed.warnings.some(x=>x.includes('MAINが3枚')));
const bad=items.map(x=>({...x,transform:[...x.transform]}));bad[1].str='4';assert(parseDeckTextItems(bad).warnings.some(x=>x.includes('PDF記載4枚')));
assert.equal(suggestedDeckName('DK0041672612_61_ja_260826_-_烙印_.pdf'),'烙印');assert.throws(()=>parseDeckTextItems([]),/識別/);
console.log('PASS: PDF column mapping, counts, mismatch warning, filename, unsupported format');
