// Simplified CandyPop fixed: touch support + popup fix
const COLS = 8, ROWS = 8, TYPES = 5;
let board = [], score = 0, moves = 0;
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const overlay = document.getElementById('overlay');
const popupOk = document.getElementById('popup-ok');
const restartBtn = document.getElementById('restart');
const bgMusic = document.getElementById('bg-music');
const sounds = [];
for(let i=0;i<TYPES;i++) sounds.push(document.getElementById('sound-'+i));
bgMusic.src = 'assets/sounds/bg_loop.wav';
for(let i=0;i<TYPES;i++) sounds[i].src = `assets/sounds/snd_${i}.wav`;

// Utilities
function randType(){ return Math.floor(Math.random()*TYPES); }
function id(r,c){ return `cell-${r}-${c}`; }

function initBoard(){
  board = [];
  for(let r=0;r<ROWS;r++){
    const row=[];
    for(let c=0;c<COLS;c++) row.push({type:randType()});
    board.push(row);
  }
  // remove immediate matches
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ while(checkThreeAt(r,c)) board[r][c].type = randType(); }
  score=0; moves=0; updateHUD();
  renderBoard();
  bgMusic.play().catch(()=>{});
}

function renderBoard(){
  boardEl.innerHTML='';
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const cell = document.createElement('div');
      cell.className = 'cell'; cell.id = id(r,c);
      const img = document.createElement('img'); img.src = `assets/candies/candy_${board[r][c].type}.svg`;
      cell.appendChild(img);
      // mouse handlers
      cell.addEventListener('click', ()=> onCellClick(r,c));
      cell.addEventListener('touchstart', (e)=> onTouchStart(e, r, c), {passive:false});
      cell.addEventListener('touchmove', (e)=> onTouchMove(e, r, c), {passive:false});
      cell.addEventListener('touchend', (e)=> onTouchEnd(e, r, c));
      boardEl.appendChild(cell);
    }
  }
}

let selected = null;
function onCellClick(r,c){
  if(selected==null){ selected={r,c}; document.getElementById(id(r,c)).classList.add('selected'); }
  else {
    if(selected.r===r && selected.c===c){ document.getElementById(id(r,c)).classList.remove('selected'); selected=null; return; }
    const dr = Math.abs(selected.r - r), dc = Math.abs(selected.c - c);
    if((dr+dc)===1){ swapAndResolve(selected.r,selected.c,r,c); document.getElementById(id(selected.r,selected.c)).classList.remove('selected'); selected=null; }
    else { document.getElementById(id(selected.r,selected.c)).classList.remove('selected'); selected={r,c}; document.getElementById(id(r,c)).classList.add('selected'); }
  }
}

// Touch swipe implementation: start->move->end, detect swipe direction and swap
let touchInfo = null;
function onTouchStart(e,r,c){
  e.preventDefault();
  const t = e.touches[0];
  touchInfo = {startX: t.clientX, startY: t.clientY, r, c, moved:false};
}
function onTouchMove(e,r,c){
  if(!touchInfo) return;
  e.preventDefault();
  const t = e.touches[0];
  const dx = t.clientX - touchInfo.startX, dy = t.clientY - touchInfo.startY;
  const dist = Math.hypot(dx, dy);
  if(dist > 18 && !touchInfo.moved){
    touchInfo.moved = true;
    let tr = touchInfo.r, tc = touchInfo.c;
    if(Math.abs(dx) > Math.abs(dy)) tc += dx>0?1:-1; else tr += dy>0?1:-1;
    if(tr>=0 && tr<ROWS && tc>=0 && tc<COLS){ swapAndResolve(touchInfo.r, touchInfo.c, tr, tc); touchInfo=null; }
  }
}
function onTouchEnd(e,r,c){ touchInfo = null; }

function swapAndResolve(r1,c1,r2,c2){
  moves++; updateHUD();
  // swap
  const tmp = board[r1][c1]; board[r1][c1] = board[r2][c2]; board[r2][c2] = tmp;
  renderBoard();
  // sound for swapped candy
  sounds[ board[r2][c2].type ].currentTime = 0; sounds[ board[r2][c2].type ].play().catch(()=>{});
  const matches = findMatches();
  if(matches.length===0){
    // invalid swap, revert shortly
    setTimeout(()=>{ const t = board[r1][c1]; board[r1][c1]=board[r2][c2]; board[r2][c2]=t; renderBoard(); }, 200);
    return;
  }
  resolveMatches();
}

function findMatches(){
  const hits = [];
  // horizontal
  for(let r=0;r<ROWS;r++){
    let runType=null, runStart=0, runLen=0;
    for(let c=0;c<=COLS;c++){
      const t = (c<COLS)?board[r][c].type:null;
      if(t===runType) runLen++; else {
        if(runLen>=3) hits.push({type:runType, coords: Array.from({length:runLen},(_,i)=>[r, runStart+i])});
        runType=t; runStart=c; runLen=1;
      }
    }
  }
  // vertical
  for(let c=0;c<COLS;c++){
    let runType=null, runStart=0, runLen=0;
    for(let r=0;r<=ROWS;r++){
      const t = (r<ROWS)?board[r][c].type:null;
      if(t===runType) runLen++; else {
        if(runLen>=3) hits.push({type:runType, coords: Array.from({length:runLen},(_,i)=>[runStart+i, c])});
        runType=t; runStart=r; runLen=1;
      }
    }
  }
  return hits;
}

function resolveMatches(){
  const matches = findMatches();
  if(matches.length===0){ renderBoard(); return; }
  // remove matched cells
  let removed = 0;
  matches.forEach(m=>{
    removed += m.coords.length;
    // show popup for each match (but queue if multiple): here simply show once per resolve
  });
  // show popup once per resolve cycle
  document.getElementById('popup-title').textContent = 'Sweet!';
  document.getElementById('popup-msg').textContent = `You matched ${removed} candies.`;
  showPopup();
  // play sound for first match type if available
  if(matches[0]){ const t = matches[0].type; sounds[t].currentTime=0; sounds[t].play().catch(()=>{}); }
  // mark removals
  const toRem = new Set();
  matches.forEach(m=> m.coords.forEach(([r,c])=> toRem.add(`${r},${c}`)));
  toRem.forEach(k=>{ const [r,c]=k.split(',').map(x=>parseInt(x,10)); board[r][c]=null; });
  score += removed*10; updateHUD();
  setTimeout(()=>{ gravityAndRefill(); setTimeout(()=> resolveMatches(), 260); }, 260);
}

function gravityAndRefill(){
  for(let c=0;c<COLS;c++){
    let write = ROWS-1;
    for(let r=ROWS-1;r>=0;r--){
      if(board[r][c]!==null){ board[write][c]=board[r][c]; write--; }
    }
    for(let r=write;r>=0;r--) board[r][c] = {type:randType()};
  }
  renderBoard();
}

function updateHUD(){ scoreEl.textContent = score; movesEl.textContent = moves; }

function showPopup(){ overlay.classList.remove('hidden'); }
function hidePopup(){ overlay.classList.add('hidden'); }
popupOk.addEventListener('click', ()=> { hidePopup(); }); // fixed: properly hide on click

// restart button
restartBtn.addEventListener('click', ()=> initBoard());

// start
window.addEventListener('load', ()=> initBoard());

// prevent default scroll on swipe inside board for mobile
boardEl.addEventListener('touchmove', (e)=>{ e.preventDefault(); }, {passive:false});
