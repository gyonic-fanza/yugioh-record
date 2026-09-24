import assert from 'node:assert/strict';
import {IndexedDBRepository} from '../js/storage.js';

const closing=()=>new DOMException('The database connection is closing.','InvalidStateError');
const stale={closed:false,close(){this.closed=true;},transaction(){throw closing();}};
let transactions=0;
const healthy={close(){},transaction(){
 transactions++;
 const tx={error:null,objectStore(){return {get(id){const request={result:{id}};queueMicrotask(()=>{request.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return request;}};}};
 return tx;
}};
const repo=Object.create(IndexedDBRepository.prototype);
repo.db=stale;repo.ready=Promise.resolve(stale);let opens=0;
repo.open=()=>{opens++;repo.db=healthy;return Promise.resolve(healthy);};
assert.deepEqual(await repo.get('decks','test-id'),{id:'test-id'});
assert.equal(opens,1);assert.equal(transactions,1);assert.equal(stale.closed,true);
assert.deepEqual(await repo.get('decks','again'),{id:'again'});
assert.equal(opens,1);

// Safari may fire onclose while a tab is suspended: the next operation must reopen.
repo.invalidate(healthy);assert.equal(repo.ready,null);
assert.deepEqual(await repo.get('decks','resumed'),{id:'resumed'});
assert.equal(opens,2);

// A logical data error is not treated as a stale connection.
const invalid={close(){throw Error('should not close');},transaction(){throw new DOMException('invalid key','DataError');}};
repo.db=invalid;repo.ready=Promise.resolve(invalid);
await assert.rejects(repo.get('decks','bad'),{name:'DataError'});
assert.equal(opens,2);
console.log('PASS: closed IndexedDB handle reconnects, completed transactions resolve, unrelated errors propagate');
