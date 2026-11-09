(() => {
  const $ = selector => document.querySelector(selector);
  const words = window.DAGENS_ORD || [];
  const defaultSequence = words.map(item => item.ord);
  let sequence = [];
  let sequenceIndex = Number(localStorage.getItem("dagens-ord-index") || -1);
  let currentWord = words.find(item => item.ord === "sol") || words[0] || {ord:"sol",stavelser:["sol"],vokallyd:"kort"};
  let isSpinning = false;
  let hasResult = false;
  let revealedLetters = 0;
  let activeWord = "";
  const alphabetUpper = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ"];
  let slotLetterCase = localStorage.getItem("dagens-ord-letter-case") || "upper";
  const getAlphabet = () => slotLetterCase === "lower"
    ? alphabetUpper.map(letter => letter.toLocaleLowerCase("nb-NO"))
    : [...alphabetUpper];
  const formatSlotLetter = letter => slotLetterCase === "lower"
    ? letter.toLocaleLowerCase("nb-NO")
    : letter.toLocaleUpperCase("nb-NO");

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));

  function loadSequence() {
    let savedWord = "";
    try {
      const saved = JSON.parse(localStorage.getItem("dagens-ord-sequence") || "null");
      if (Array.isArray(saved) && saved.length) {
        const savedIndex = Number(localStorage.getItem("dagens-ord-index") || 0);
        savedWord = saved[Math.max(0, Math.min(saved.length - 1, savedIndex))] || saved[0] || "";
      }
    } catch {
      savedWord = "";
    }

    // Bakoverkompatibilitet: eldre versjoner lagret en ordliste.
    const initialWord = savedWord || defaultSequence[0] || "sol";
    sequence = [initialWord];
    $("#wordSequence").value = initialWord;
  }

  function getWordData(word) {
    const found = words.find(item => item.ord.toLocaleLowerCase("nb-NO") === word.toLocaleLowerCase("nb-NO"));
    return found ? {...found, ord:word} : {
      ord:word, stavelser:[word], vokallyd:"varierer", forklaring:"", setning:"",
      engelsk:"", rim:[], synonymer:[], nye_ord:[]
    };
  }

  function buildLetterReels(word) {
    const holder = $("#slotReels");
    holder.innerHTML = "";
    const letters = [...word].map(formatSlotLetter);
    const alphabet = getAlphabet();
    holder.style.setProperty("--reel-count", letters.length);
    letters.forEach((letter, index) => {
      const reel = document.createElement("div");
      reel.className = "slot-reel letter-reel unrevealed";
      reel.setAttribute("aria-label", `Bokstav ${index + 1}, ikke avslørt`);
      const windowBox = document.createElement("div");
      windowBox.className = "reel-window";
      const star = document.createElement("span");
      star.className = "reel-star";
      star.textContent = "★";
      const strip = document.createElement("div");
      strip.className = "alphabet-strip";
      [...alphabet, ...alphabet, ...alphabet].forEach(ch => {
        const cell = document.createElement("span");
        cell.className = "alphabet-cell";
        cell.textContent = ch;
        strip.appendChild(cell);
      });
      windowBox.append(star, strip);
      reel.appendChild(windowBox);
      holder.appendChild(reel);
    });
  }

  function revealNextLetter() {
    if (!activeWord || isSpinning || revealedLetters >= [...activeWord].length) return;
    isSpinning = true;
    const index = revealedLetters;
    const target = formatSlotLetter([...activeWord][index]);
    const alphabet = getAlphabet();
    const reel = $("#slotReels").children[index];
    const strip = reel.querySelector(".alphabet-strip");
    const targetIndex = alphabet.indexOf(target);
    $("#slotMessage").textContent = `Bokstav ${index + 1} av ${[...activeWord].length} snurrer ...`;
    $("#pullLever").disabled = true;
    $("#pullLever").classList.add("pulled");
    reel.classList.remove("unrevealed");
    reel.classList.add("reel-spinning");
    reel.setAttribute("aria-label", `Bokstav ${index + 1}, snurrer`);

    // Hjulet går gjennom to hele alfabet før det lander på dagens bokstav.
    requestAnimationFrame(() => {
      const cellHeight = strip.querySelector(".alphabet-cell")?.getBoundingClientRect().height || 72;
      strip.style.transform = `translateY(-${(alphabet.length * 2 + targetIndex - 1) * cellHeight}px)`;
    });

    window.setTimeout(() => {
      reel.classList.remove("reel-spinning");
      reel.classList.add("letter-revealed");
      // Marker bokstaven som står i leselinjen, slik at nabobokstavene kan tones ned.
      strip.querySelectorAll(".alphabet-cell").forEach(cell => cell.classList.remove("current-letter"));
      const stoppedCell = strip.children[alphabet.length * 2 + targetIndex];
      if (stoppedCell) stoppedCell.classList.add("current-letter");
      reel.setAttribute("aria-label", `Bokstav ${index + 1}: ${target}`);
      revealedLetters += 1;
      isSpinning = false;
      $("#pullLever").disabled = false;
      $("#pullLever").classList.remove("pulled");

      if (revealedLetters >= [...activeWord].length) {
        hasResult = true;
        $("#slotMessage").textContent = `Hele ordet er ${activeWord}!`;
        $("#exploreWord").disabled = false;
        $("#exploreWord").textContent = `✨ Utforsk «${activeWord}» →`;

        // La ordet komme ut av maskinen etter at siste hjul har stoppet.
        window.setTimeout(() => {
          if (!hasResult || isSpinning) return;
          const overlay = $("#wordRevealOverlay");
          // Knappen har ikke lenger et eget ordtekstfelt – vis bare navigasjonsknappen.
          overlay.classList.remove("hidden");
          overlay.classList.remove("word-reveal-show");
          void overlay.offsetWidth;
          overlay.classList.add("word-reveal-show");
        }, 450);
      } else {
        $("#slotMessage").textContent = `Bra! Trekk i spaken for neste bokstav (${revealedLetters + 1}/${[...activeWord].length}).`;
        $("#exploreWord").disabled = true;
      }
    }, 2350);
  }

  function spinSlot() {
    if (isSpinning) return;
    if (!activeWord || revealedLetters >= [...activeWord].length) {
      if (!sequence.length) return;
      sequenceIndex = (sequenceIndex + 1) % sequence.length;
      activeWord = sequence[sequenceIndex];
      currentWord = getWordData(activeWord);
      localStorage.setItem("dagens-ord-index", String(sequenceIndex));
      revealedLetters = 0;
      hasResult = false;
      buildLetterReels(activeWord);
      $("#exploreWord").disabled = true;
      $("#exploreWord").textContent = "✨ Utforsk ordet →";
    }
    revealNextLetter();
  }

  function fitCenterWord() {
    const field = $("#mindmapCenterWord");
    const tile = field?.closest(".node-center");
    if (!field || !tile) return;
    const rect = tile.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const maxWidth = rect.width * .88;
    const maxHeight = rect.height * .78;
    const canvas = fitCenterWord.canvas || (fitCenterWord.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    const style = getComputedStyle(field);
    let size = Math.min(maxHeight, 240);
    ctx.font = `${style.fontWeight || 900} ${size}px ${style.fontFamily}`;
    const measured = Math.max(1, ctx.measureText(field.textContent).width);
    if (measured > maxWidth) size *= maxWidth / measured;
    field.style.fontSize = `${Math.max(12, Math.floor(size))}px`;
  }

  let inkColor = "#202124", inkWidth = 3, inkShape = "free", inkEraser = false, eraserWidth = 28;

  function setupInkCanvas(canvas) {
    if (canvas.dataset.ready === "true") return;
    canvas.dataset.ready = "true";
    const context = canvas.getContext("2d");
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const old = document.createElement("canvas");
      old.width = canvas.width; old.height = canvas.height;
      old.getContext("2d").drawImage(canvas,0,0);
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio,0,0,ratio,0,0);
      context.lineCap = "round"; context.lineJoin = "round";
      if (old.width && old.height) context.drawImage(old,0,0,old.width,old.height,0,0,rect.width,rect.height);
    };
    resize();
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    let drawing=false, startPoint=null, previousPoint=null, snapshot=null;
    const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
    const applyInk=()=>{context.lineWidth=inkEraser?eraserWidth:inkWidth;context.strokeStyle=inkColor;context.globalCompositeOperation=inkEraser?"destination-out":"source-over";};
    const drawShape=(a,b)=>{
      const left=Math.min(a.x,b.x),top=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
      context.beginPath();
      if(inkShape==="quad") context.rect(left,top,w,h);
      else if(inkShape==="circle") context.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.max(1,w/2),Math.max(1,h/2),0,0,Math.PI*2);
      else if(inkShape==="isosceles"){context.moveTo((a.x+b.x)/2,a.y);context.lineTo(b.x,b.y);context.lineTo(a.x,b.y);context.closePath();}
      else if(inkShape==="rightTriangle"){context.moveTo(a.x,a.y);context.lineTo(a.x,b.y);context.lineTo(b.x,b.y);context.closePath();}
      context.stroke();
    };
    canvas.addEventListener("pointerdown",e=>{
      drawing=true;canvas.setPointerCapture(e.pointerId);startPoint=point(e);previousPoint=startPoint;applyInk();
      if(inkShape!=="free"&&!inkEraser){snapshot=document.createElement("canvas");snapshot.width=canvas.width;snapshot.height=canvas.height;snapshot.getContext("2d").drawImage(canvas,0,0);}
      else{context.beginPath();context.moveTo(startPoint.x,startPoint.y);context.lineTo(startPoint.x+.1,startPoint.y+.1);context.stroke();}
      e.preventDefault();
    });
    canvas.addEventListener("pointermove",e=>{
      if(!drawing)return;const p=point(e);applyInk();
      if(inkShape!=="free"&&!inkEraser&&snapshot){
        context.save();context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(snapshot,0,0);context.restore();drawShape(startPoint,p);
      }else{context.beginPath();context.moveTo(previousPoint.x,previousPoint.y);context.lineTo(p.x,p.y);context.stroke();previousPoint=p;}
      e.preventDefault();
    });
    const stop=()=>{drawing=false;context.closePath();snapshot=null;context.globalCompositeOperation="source-over";};
    ["pointerup","pointercancel","lostpointercapture"].forEach(name=>canvas.addEventListener(name,stop));
  }

  function updateInkToolbar(){
    document.querySelectorAll(".ink-color").forEach(b=>b.classList.toggle("active",b.dataset.color===inkColor));
    document.querySelectorAll(".ink-width").forEach(b=>b.classList.toggle("active",Number(b.dataset.width)===inkWidth));
    document.querySelectorAll(".ink-shape").forEach(b=>b.classList.toggle("active",b.dataset.shape===inkShape&&!inkEraser));
    $("#inkEraser").classList.toggle("active",inkEraser);
  }
  document.querySelectorAll(".ink-color").forEach(b=>b.addEventListener("click",()=>{inkColor=b.dataset.color;inkEraser=false;updateInkToolbar();}));
  document.querySelectorAll(".ink-width").forEach(b=>b.addEventListener("click",()=>{inkWidth=Number(b.dataset.width);updateInkToolbar();}));
  document.querySelectorAll(".ink-shape").forEach(b=>b.addEventListener("click",()=>{inkShape=b.dataset.shape;inkEraser=false;updateInkToolbar();}));
  document.querySelectorAll(".eraser-width").forEach(b=>b.addEventListener("click",()=>{
    eraserWidth=Number(b.dataset.eraserWidth);
    document.querySelectorAll(".eraser-width").forEach(x=>x.classList.toggle("active",x===b));
    inkEraser=true;inkShape="free";updateInkToolbar();
  }));
  $("#inkEraser").addEventListener("click",()=>{inkEraser=!inkEraser;if(inkEraser)inkShape="free";updateInkToolbar();});
  updateInkToolbar();

  // Tøm bare skriveinnholdet i den valgte oppgaveboksen.
  document.querySelectorAll(".clear-node-button").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const node = button.closest(".mind-node");
      if (!node) return;
      const heading = node.querySelector("h2")?.textContent?.trim() || "denne oppgaven";
      if (!window.confirm(`Vil du tømme alt innhold i «${heading}»? Dette kan ikke angres.`)) return;
      node.querySelectorAll(".ink-canvas").forEach(canvas => {
        const context = canvas.getContext("2d");
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.restore();
      });
      node.querySelectorAll("input:not([type=button]), textarea").forEach(field => {
        field.value = "";
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
  });

  // Lagre/lukk avslutter fokusvisningen uten å fjerne innholdet.
  document.querySelectorAll(".save-close-node-button").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      clearTaskFocus();
    });
  });

  function setTaskFocus(node) {
    const board = $("#mindmapBoard");
    if (!node || node.classList.contains("node-center")) return;
    board.classList.add("task-focus-mode");
    board.querySelectorAll(".mind-node").forEach(item => item.classList.toggle("is-focused", item === node));
  }

  function clearTaskFocus() {
    const board = $("#mindmapBoard");
    board.classList.remove("task-focus-mode");
    board.querySelectorAll(".mind-node").forEach(item => item.classList.remove("is-focused"));
  }

  const WORD_ARCHIVE_KEY = "dagens-ord-archive-v1";

  function readWordArchive() {
    try {
      const value = JSON.parse(localStorage.getItem(WORD_ARCHIVE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function captureMindmapPage() {
    const word = ($("#mindmapCenterWord").textContent || activeWord || currentWord.ord || "").trim();
    const drawings = [...$("#mindmapBoard").querySelectorAll(".ink-canvas")].map((canvas,index) => ({
      index, image: canvas.toDataURL("image/png")
    }));
    return { word, drawings, savedAt: new Date().toISOString() };
  }

  function saveMindmapPage() {
    const page = captureMindmapPage();
    if (!page.word) { alert("Det finnes ikke noe ord å lagre."); return; }
    const archive = readWordArchive();
    const key = page.word.toLocaleLowerCase("nb-NO");
    const existing = archive.findIndex(item => item.word.toLocaleLowerCase("nb-NO") === key);
    if (existing >= 0) {
      const replace = confirm(`«${page.word}» finnes allerede i arkivet. Vil du oppdatere den lagrede siden med det som står på tankekartet nå?`);
      if (!replace) return;
      archive[existing] = page;
    } else {
      archive.unshift(page);
    }
    try {
      localStorage.setItem(WORD_ARCHIVE_KEY, JSON.stringify(archive));
      alert(`«${page.word}» er lagret i Tidligere dagens ord.`);
    } catch (error) {
      alert("Kunne ikke lagre siden. Nettleserens lokale lagringsplass kan være full.");
    }
  }

  function renderWordArchive() {
    const list = $("#wordArchiveList");
    const archive = readWordArchive();
    list.innerHTML = "";
    if (!archive.length) {
      list.innerHTML = '<div class="archive-empty">Ingen lagrede ord ennå.<br>Trykk «Lagre siden» når du vil ta vare på et tankekart.</div>';
      return;
    }
    archive.sort((a,b) => new Date(b.savedAt) - new Date(a.savedAt));
    archive.forEach(item => {
      const row = document.createElement("div");
      row.className = "archive-row";
      const info = document.createElement("div");
      info.className = "archive-item-info";
      const title = document.createElement("strong");
      title.textContent = item.word;
      const date = document.createElement("small");
      date.textContent = new Date(item.savedAt).toLocaleString("nb-NO");
      info.append(title,date);
      const actions = document.createElement("div");
      actions.className = "archive-item-actions";
      const open = document.createElement("button");
      open.type = "button"; open.className = "archive-open"; open.textContent = "Åpne";
      open.addEventListener("click", () => openArchivedWord(item));
      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "archive-delete"; remove.textContent = "Slett";
      remove.addEventListener("click", () => {
        if (!confirm(`Vil du slette «${item.word}» fra arkivet?`)) return;
        localStorage.setItem(WORD_ARCHIVE_KEY, JSON.stringify(readWordArchive().filter(x => x.word.toLocaleLowerCase("nb-NO") !== item.word.toLocaleLowerCase("nb-NO"))));
        renderWordArchive();
      });
      actions.append(open,remove); row.append(info,actions); list.append(row);
    });
  }

  function openArchivedWord(item) {
    activeWord = item.word;
    currentWord = getWordData(item.word);
    sequence = [item.word];
    sequenceIndex = -1;
    revealedLetters = [...item.word].length;
    hasResult = true;
    isSpinning = false;
    localStorage.setItem("dagens-ord-sequence", JSON.stringify(sequence));
    localStorage.setItem("dagens-ord-index", "-1");
    $("#wordSequence").value = item.word;
    $("#wordArchiveDialog").close();
    openMindmap();
    requestAnimationFrame(() => {
      const canvases = $("#mindmapBoard").querySelectorAll(".ink-canvas");
      canvases.forEach((canvas,index) => {
        setupInkCanvas(canvas);
        const drawing = item.drawings?.find(entry => entry.index === index);
        if (!drawing?.image) return;
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext("2d");
          const rect = canvas.getBoundingClientRect();
          ctx.clearRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img,0,0,rect.width,rect.height);
        };
        img.src = drawing.image;
      });
    });
  }

  let mindmapSessionWord = null;

  function clearAllMindmapInk() {
    $("#mindmapBoard").querySelectorAll(".ink-canvas").forEach(canvas => {
      const context = canvas.getContext("2d");
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
    });
  }

  function openMindmap() {
    const incomingWord = (activeWord || currentWord.ord || "").trim();
    // Hvert nytt ord starter med et rent tankekart. Arkiverte tegninger
    // legges tilbake eksplisitt etter at arkivordet er åpnet.
    if (mindmapSessionWord !== incomingWord) {
      clearAllMindmapInk();
      mindmapSessionWord = incomingWord;
    }
    $("#wordRevealOverlay").classList.add("hidden");
    $("#wordRevealOverlay").classList.remove("word-reveal-show");
    $("#slotHome").classList.add("hidden");
    $("#wordToolModule").classList.add("hidden");
    $("#wordMindmap").classList.remove("hidden");
    clearTaskFocus();
    document.body.classList.add("mindmap-open");

    // Slot-maskinen er fasiten: tankekartet skal alltid starte med nøyaktig
    // det ordet læreren valgte og som elevene nettopp har avslørt.
    if (activeWord) currentWord = getWordData(activeWord);
    const field=$("#mindmapCenterWord");
    field.textContent = activeWord || currentWord.ord;
    requestAnimationFrame(()=> {
      fitCenterWord();
      $("#wordMindmap").querySelectorAll(".ink-canvas").forEach(setupInkCanvas);
    });
  }

  function makeWordSearch(word) {
    const target=[...word.toLocaleUpperCase("nb-NO")];
    const alphabet=[..."ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ"];
    let size=Math.max(9,target.length+2);
    const directions=[{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1},{dr:1,dc:-1}];
    for(let attemptSize=0;attemptSize<5;attemptSize++,size++){
      for(let attempt=0;attempt<250;attempt++){
        const grid=Array.from({length:size},()=>Array(size).fill(""));
        const paths=[];
        const occupied=new Set();
        const shuffled=[...directions].sort(()=>Math.random()-.5);
        let valid=true;
        for(const {dr,dc} of shuffled){
          const starts=[];
          for(let r=0;r<size;r++) for(let c=0;c<size;c++){
            const er=r+dr*(target.length-1), ec=c+dc*(target.length-1);
            if(er<0||er>=size||ec<0||ec>=size) continue;
            const cells=target.map((_,i)=>`${r+dr*i},${c+dc*i}`);
            if(cells.every(key=>!occupied.has(key))) starts.push({r,c,cells});
          }
          if(!starts.length){valid=false;break;}
          const chosen=starts[Math.floor(Math.random()*starts.length)];
          const path=target.map((ch,i)=>{
            const r=chosen.r+dr*i,c=chosen.c+dc*i;
            grid[r][c]=ch;occupied.add(`${r},${c}`);
            return {r,c};
          });
          paths.push(path);
        }
        if(!valid) continue;
        for(let r=0;r<size;r++) for(let c=0;c<size;c++)
          if(!grid[r][c]) grid[r][c]=alphabet[Math.floor(Math.random()*alphabet.length)];
        return {grid,paths};
      }
    }
    // Siste reserve: større rutenett gjør plassering robust også for lange ord.
    return makeWordSearchFallback(target,alphabet,size+3);
  }

  function makeWordSearchFallback(target,alphabet,size){
    const grid=Array.from({length:size},()=>Array(size).fill(""));
    const directions=[{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1},{dr:1,dc:-1}];
    const paths=directions.map(({dr,dc},idx)=>{
      const r=idx===0?0:1,c=idx===3?size-1:0;
      return target.map((ch,i)=>{
        const rr=r+dr*i,cc=c+dc*i;grid[rr][cc]=ch;return {r:rr,c:cc};
      });
    });
    for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(!grid[r][c])grid[r][c]=alphabet[Math.floor(Math.random()*alphabet.length)];
    return {grid,paths};
  }

  function openWordTool() {
    const module=$("#wordToolModule");
    const content=$("#wordToolContent");
    {
      const search=makeWordSearch(currentWord.ord);
      const grid=search.grid, paths=search.paths;
      $("#wordToolTitle").textContent="Ordsøk";
      content.innerHTML=`<p class="tool-instruction">Finn dagens ord fire ganger! Trykk på bokstavene i riktig rekkefølge, eller ring rundt ordene med digital penn.</p><div class="word-search-stage"><div class="word-search-grid mindmap-word-search" style="--search-cols:${grid.length}">${grid.map((row,r)=>row.map((ch,c)=>`<span data-r="${r}" data-c="${c}">${ch}</span>`).join("")).join("")}</div><canvas class="word-search-ink" aria-label="Tegn med digital penn rundt ordene"></canvas></div><p class="word-search-feedback" aria-live="polite">0 av 4 ord funnet</p>`;
      const stage=content.querySelector(".word-search-stage");
      const gridEl=stage.querySelector(".mindmap-word-search");
      const ink=stage.querySelector(".word-search-ink");
      let found=0, candidates=[], drawing=false, lastPoint=null;
      const cells=[...gridEl.querySelectorAll("span")];
      const cellAt=(r,c)=>gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      const feedback=content.querySelector(".word-search-feedback");
      const markFound=path=>{
        const colorClass=`word-found-${found+1}`;
        path.forEach(({r,c})=>cellAt(r,c)?.classList.add("word-found",colorClass));
        found++;
        feedback.textContent=`${found} av 4 ord funnet${found===4?" – kjempebra! 🎉":""}`;
        if(found===4){feedback.classList.add("all-found");stage.classList.add("all-words-found");}
      };
      const handleCell=(r,c)=>{
        const key=`${r},${c}`;
        let next=candidates.filter(item=>item.path[item.index] && `${item.path[item.index].r},${item.path[item.index].c}`===key);
        if(next.length){
          next=next.map(item=>({...item,index:item.index+1}));
          const completed=next.find(item=>item.index===item.path.length);
          if(completed){markFound(completed.path);candidates=[];return;}
          candidates=next;return;
        }
        // Feil bokstav avbryter den påbegynte rekken. Et nytt ord kan startes her.
        candidates=paths.filter(path=>path[0].r===r&&path[0].c===c).map(path=>({path,index:1}));
      };
      stage.addEventListener("click",e=>{
        if(e.target.closest(".word-search-ink")) return;
        const cell=e.target.closest(".mindmap-word-search span");
        if(cell) handleCell(Number(cell.dataset.r),Number(cell.dataset.c));
      });
      const resizeInk=()=>{
        const rect=stage.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
        ink.width=Math.round(rect.width*ratio);ink.height=Math.round(rect.height*ratio);
        ink.getContext("2d").setTransform(ratio,0,0,ratio,0,0);
      };
      resizeInk();
      const penPoint=e=>{const r=ink.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
      ink.addEventListener("pointerdown",e=>{
        if(e.pointerType!=="pen"){
          const rect=gridEl.getBoundingClientRect();
          const x=e.clientX-rect.left,y=e.clientY-rect.top;
          const col=Math.floor(x/(rect.width/grid.length)),row=Math.floor(y/(rect.height/grid.length));
          if(row>=0&&row<grid.length&&col>=0&&col<grid.length)handleCell(row,col);
          return;
        }
        drawing=true;ink.setPointerCapture(e.pointerId);lastPoint=penPoint(e);
        const ctx=ink.getContext("2d");ctx.beginPath();ctx.moveTo(lastPoint.x,lastPoint.y);
        ctx.strokeStyle=inkEraser?"rgba(0,0,0,1)":inkColor;ctx.lineWidth=inkEraser?eraserWidth:inkWidth;ctx.lineCap="round";ctx.lineJoin="round";
        ctx.globalCompositeOperation=inkEraser?"destination-out":"source-over";e.preventDefault();
      });
      ink.addEventListener("pointermove",e=>{
        if(!drawing||e.pointerType!=="pen")return;
        const p=penPoint(e),ctx=ink.getContext("2d");ctx.lineTo(p.x,p.y);ctx.stroke();lastPoint=p;e.preventDefault();
      });
      const stopDrawing=()=>{drawing=false;lastPoint=null;};
      ink.addEventListener("pointerup",stopDrawing);ink.addEventListener("pointercancel",stopDrawing);
      if("ResizeObserver" in window)new ResizeObserver(resizeInk).observe(stage);
    }
    $("#wordMindmap").classList.add("hidden");
    module.classList.remove("hidden");
    requestAnimationFrame(()=>module.querySelectorAll(".ink-canvas").forEach(setupInkCanvas));
  }

  function closeWordTool() {
    $("#wordToolModule").classList.add("hidden");
    $("#wordMindmap").classList.remove("hidden");
  }

  function clearMindmap() {
    $("#wordMindmap").querySelectorAll(".ink-canvas").forEach(canvas=>{
      canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
    });
  }

  $("#pullLever").addEventListener("click",spinSlot);
  $("#wordRevealCard").addEventListener("click",()=>{if(hasResult&&!isSpinning)openMindmap();});
  $("#slotResult").addEventListener("click",()=>{if(hasResult&&!isSpinning)openMindmap();});
  $("#exploreWord").addEventListener("click",()=>{if(hasResult&&!isSpinning)openMindmap();});
  $("#openTeacherMenu").addEventListener("click",()=>$("#teacherMenu").showModal());
  $("#slotLetterCase").value = slotLetterCase;
  $("#slotLetterCase").addEventListener("change", event => {
    slotLetterCase = event.target.value === "lower" ? "lower" : "upper";
    localStorage.setItem("dagens-ord-letter-case", slotLetterCase);
    // Hvis ingen bokstaver er avslørt ennå, oppdater hjulene med en gang.
    if (activeWord && revealedLetters === 0 && !isSpinning) {
      buildLetterReels(activeWord);
    }
  });
  function saveTeacherWord() {
    const word=$("#wordSequence").value.trim();
    if(!word){alert("Skriv inn dagens ord.");return "";}
    if(/\s/.test(word)){alert("Skriv bare ett ord. Bruk bindestrek hvis ordet trenger det.");return "";}

    sequence=[word];
    currentWord = getWordData(word);
    localStorage.setItem("dagens-ord-sequence",JSON.stringify(sequence));
    sequenceIndex=-1;
    localStorage.setItem("dagens-ord-index","-1");
    activeWord=word;
    mindmapSessionWord = null;
    revealedLetters=0;
    hasResult=false;
    return word;
  }

  $("#openMindmapDirect").addEventListener("click",()=>{
    const word=saveTeacherWord();
    if(!word) return;
    $("#teacherMenu").close();
    $("#wordRevealOverlay").classList.add("hidden");
    $("#wordRevealOverlay").classList.remove("word-reveal-show");
    openMindmap();
  });

  $("#saveWordSequence").addEventListener("click",()=>{
    const word=$("#wordSequence").value.trim();
    if(!word){alert("Skriv inn dagens ord.");return;}
    if(/\s/.test(word)){alert("Skriv bare ett ord. Bruk bindestrek hvis ordet trenger det.");return;}

    sequence=[word];
    currentWord = getWordData(word);
    localStorage.setItem("dagens-ord-sequence",JSON.stringify(sequence));
    sequenceIndex=-1;
    localStorage.setItem("dagens-ord-index","-1");
    $("#teacherMenu").close();
    $("#slotMessage").textContent=`Dagens ord er «${word}». Trekk i spaken!`;
    $("#wordRevealOverlay").classList.add("hidden");
    $("#wordRevealOverlay").classList.remove("word-reveal-show");
    $("#exploreWord").disabled=true;
    hasResult=false;
    activeWord="";
    revealedLetters=0;
    $("#slotReels").innerHTML='<div class="slot-empty">Trekk i spaken for å starte!</div>';
  });
  $("#resetWordSequence").addEventListener("click",()=>{
    const exampleWord = defaultSequence[0] || "sol";
    $("#wordSequence").value=exampleWord;
  });
  $("#mindmapBoard").addEventListener("click", event => {
    const icon = event.target.closest(".node-icon");
    if (!icon) return;
    const node = icon.closest(".mind-node");
    if (node && !node.classList.contains("node-center")) setTaskFocus(node);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $("#mindmapBoard").classList.contains("task-focus-mode")) clearTaskFocus();
  });
  $("#toggleMindmapSidebar").addEventListener("click",()=>{
    const root=$("#wordMindmap");
    const collapsed=root.classList.toggle("sidebar-collapsed");
    $("#toggleMindmapSidebar").setAttribute("aria-label",collapsed?"Vis meny":"Skjul meny");
  });
  $("#openSearchModule").addEventListener("click",openWordTool);
  $("#closeWordTool").addEventListener("click",closeWordTool);
  $("#clearMindmap").addEventListener("click",clearMindmap);
  $("#saveMindmapPage").addEventListener("click", saveMindmapPage);
  $("#openWordArchive").addEventListener("click",()=>{ renderWordArchive(); $("#wordArchiveDialog").showModal(); });
  $("#closeWordArchive").addEventListener("click",()=>$("#wordArchiveDialog").close());

  $("#backToSlot").addEventListener("click",()=>{
    $("#wordRevealOverlay").classList.add("hidden");
    $("#wordRevealOverlay").classList.remove("word-reveal-show");
    $("#wordMindmap").classList.add("hidden");
    $("#wordToolModule").classList.add("hidden");
    $("#slotHome").classList.remove("hidden");
    document.body.classList.remove("mindmap-open");
    mindmapSessionWord = null;
    // Start slot-maskinen på nytt for det aktive ordet uten å laste siden på nytt.
    if (activeWord) {
      currentWord = getWordData(activeWord);
      revealedLetters = 0;
      hasResult = false;
      isSpinning = false;
      sequenceIndex = -1;
      buildLetterReels(activeWord);
      $("#slotMessage").textContent = "Trekk i spaken for å avsløre bokstavene!";
      $("#pullLever").disabled = false;
      $("#pullLever").classList.remove("pulled");
      $("#wordRevealOverlay").classList.add("hidden");
      $("#wordRevealOverlay").classList.remove("word-reveal-show");
    }
  });
  window.addEventListener("resize",()=>{
    if(!$("#wordMindmap").classList.contains("hidden"))fitCenterWord();
  });

  loadSequence();
  [$("#reelOne"),$("#reelTwo"),$("#reelThree")].forEach(reel=>reel.textContent="?");

  // Spaken aktiveres av spinSlot(); klassen beholdes gjennom hele snurringen.
  // Ikke fjern «pulled» på pointerup – det avbrøt bevegelsen før animasjonen var ferdig.
})();