/* ============================================================
   Daily Health Tracker — app.js
   ============================================================

   ⬇️  EDIT THESE TWO LINES ONLY  ⬇️
   Supabase Dashboard → Project Settings → API
   ============================================================ */

const SUPABASE_URL      = "https://feoyzsmzetcbovhwrzuw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Dk4ZEKzwB6z1L8u5zqIuDA_5kVLQ0Xg";

/* ============================================================
   Nothing below needs editing.

   NOTE: the client is called `sbClient`, never `supabase` —
   the CDN library already owns that global name.
   ============================================================ */

(function () {
  "use strict";

  var TABLE_NAME  = "daily_entries";
  var TOTAL_STEPS = 7;

  /* ---------- slogans shown after saving ---------- */
  var SLOGANS = [
    { line: "Small steps, every day.",        sub: "Consistency beats intensity — always." },
    { line: "Noticing is half the healing.",  sub: "What gets measured starts to make sense." },
    { line: "Another day, another data point.", sub: "The pattern is slowly revealing itself." },
    { line: "Your body keeps the score.",     sub: "Now you're reading it back." },
    { line: "Showing up is the practice.",    sub: "Today counted. Rest well." },
    { line: "Progress is quiet.",             sub: "It rarely announces itself — but it's happening." },
    { line: "One honest entry at a time.",    sub: "This is how the answer gets found." },
    { line: "Today is logged. Now let it go.", sub: "Nothing more is asked of you tonight." }
  ];

  /* ---------- fatal banner ---------- */
  function fatal(msg) {
    console.error("[Tracker]", msg);
    var bar = document.createElement("div");
    bar.setAttribute("role", "alert");
    bar.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:9999;background:#E0736B;color:#0A1118;" +
      "padding:14px 18px;font:600 14px/1.5 system-ui,sans-serif;text-align:center;";
    bar.textContent = msg;
    document.body.appendChild(bar);
  }

  /* ---------- supabase ---------- */
  var sbClient = null;
  var isConfigured =
    SUPABASE_URL.indexOf("YOUR-PROJECT-REF") === -1 &&
    SUPABASE_ANON_KEY.indexOf("YOUR-PUBLIC-ANON-KEY") === -1;
  var libLoaded = !!(window.supabase && typeof window.supabase.createClient === "function");

  if (isConfigured && libLoaded) {
    try { sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
    catch (e) { console.error("[Tracker] client error:", e); }
  }

  /* ---------- state ---------- */
  var currentStep   = 1;
  var chipState     = {};
  var selectedDate  = null;   // "YYYY-MM-DD"
  var existingRowId = null;   // uuid if editing an existing entry

  var STEP_NAMES = ["How I Feel","Body","Gut","Food","Intimacy","My Day","Review"];

  var SECTIONS = [
    { step:1, name:"How I Feel", fields:["overall","energy","mind","sleep_hours"] },
    { step:2, name:"Body",       fields:["back_pain","neck","joints"] },
    { step:3, name:"Gut",        fields:["acidity","stool","bloating"] },
    { step:4, name:"Food",       fields:["lunch","dinner","tea_coffee"] },
    { step:5, name:"Intimacy",   fields:["sex_today"] },
    { step:6, name:"My Day",     fields:["sitting","steps","stress"] }
  ];

  var REQUIRED = {
    1:["overall","energy","mind","sleep_hours"],
    2:["back_pain","neck"],
    3:["acidity","stool"],
    4:[], 5:[], 6:["sitting"], 7:[]
  };

  // fields that became chip groups in v3 (were <select>)
  // handled automatically by getValue() — listed here for reference only

  var ALL_FIELDS = [
    "overall","energy","mind","sleep_hours","sleep_quality","woke_at_night",
    "back_pain","back_pain_side","back_pain_worst","neck","joints","body_stiffness",
    "acidity","acidity_when","stool","stool_burning","bloating","water_intake",
    "lunch","dinner","fried_spicy","cold_food","ate_out","dinner_time","tea_coffee","last_caffeine",
    "sex_today","porn","back_pain_after_sex","drained_after_sex",
    "sitting","drove_km","steps","exercise","screen_time","stress","alcohol",
    "supplements","oil_massage","notes"
  ];

  var ARRAY_FIELDS = ["back_pain_worst","acidity_when","exercise"];

  /* ---------- elements ---------- */
  function $(id){ return document.getElementById(id); }

  var els = {
    steps:            Array.prototype.slice.call(document.querySelectorAll(".step")),
    backBtn:          $("backBtn"),
    nextBtn:          $("nextBtn"),
    progressFill:     $("progressFill"),
    progressLabel:    $("progressLabel"),
    progressSection:  $("progressSection"),
    progressBar:      $("progressBar"),
    dateInput:        $("dateInput"),
    calBtn:           $("calBtn"),
    calMonth:         $("calMonth"),
    calDay:           $("calDay"),
    greetHi:          $("greetHi"),
    greetSub:         $("greetSub"),
    todayBtn:         $("todayBtn"),
    reviewList:       $("reviewList"),
    saveNote:         $("saveNote"),
    toast:            $("toast"),
    toastMsg:         $("toastMsg"),
    doneScreen:       $("doneScreen"),
    doneSlogan:       $("doneSlogan"),
    doneSub:          $("doneSub"),
    doneEyebrow:      $("doneEyebrow"),
    doneEditBtn:      $("doneEditBtn"),
    doneNewBtn:       $("doneNewBtn"),
    appNav:           $("appNav")
  };

  // Verify every element this script needs actually exists. If the browser
  // served a cached/older index.html, this reports exactly what is missing
  // instead of dying silently.
  var REQUIRED_IDS = [
    "backBtn","nextBtn","progressFill","progressLabel","progressSection","progressBar",
    "dateInput","calBtn","calMonth","calDay","greetHi","greetSub","todayBtn",
    "reviewList","saveNote","toast","toastMsg",
    "doneScreen","doneSlogan","doneSub","doneEyebrow","doneEditBtn","doneNewBtn"
  ];
  var missing = REQUIRED_IDS.filter(function(id){ return !document.getElementById(id); });

  if (missing.length || !els.steps.length) {
    fatal("Old page detected \u2014 hard-refresh with Ctrl/Cmd + Shift + R. " +
          "(Missing: " + (missing.join(", ") || "form steps") + ")");
    console.error("[Tracker] index.html is out of date. Missing elements:", missing);
    return;
  }

  var ICON_NEXT  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6.5 9.6 17 4 11.5"/></svg>';

  /* ============================================================
     DATES
     ============================================================ */
  function pad(n){ return String(n).length < 2 ? "0" + n : String(n); }

  function toISO(d){ return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }

  function todayISO(){ return toISO(new Date()); }

  function parseISO(s){
    var p = String(s).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function prettyDate(iso){
    var d = parseISO(iso);
    var t = todayISO();
    if (iso === t) return "Today";

    var y = new Date(); y.setDate(y.getDate() - 1);
    if (iso === toISO(y)) return "Yesterday";

    var thisYear = new Date().getFullYear();
    var opts = d.getFullYear() === thisYear
      ? { weekday:"short", day:"numeric", month:"short" }
      : { day:"numeric", month:"short", year:"numeric" };
    return d.toLocaleDateString("en-GB", opts);
  }

  var GREET_LINES = [
    "How did today treat you?",
    "Two minutes, that's all.",
    "Let's check in.",
    "Take a moment for yourself.",
    "Tell me about today.",
    "A quick note before you rest."
  ];

  function timeGreeting(){
    var h = new Date().getHours();
    if (h < 5)  return "Still up?";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Winding down";
  }

  // Renders the top-left greeting + subtitle.
  // kind: "new" | "editing" | "offline"
  function setGreeting(kind){
    var isToday = (selectedDate === todayISO());

    if (isToday) {
      els.greetHi.innerHTML = timeGreeting() + "<span class=\"accent\">.</span>";
    } else {
      els.greetHi.textContent = prettyDate(selectedDate);
    }

    var sub, editing = false;
    if (kind === "editing")      { sub = "Picking up where you left off."; editing = true; }
    else if (kind === "offline") { sub = "Not connected \u2014 entries won't save."; editing = true; }
    else if (kind === "loading") { sub = "Checking\u2026"; }
    else if (!isToday)           { sub = "Filling in a past day."; }
    else                         { sub = GREET_LINES[new Date().getDate() % GREET_LINES.length]; }

    els.greetSub.textContent = sub;
    els.greetSub.classList.toggle("is-editing", editing);
  }

  // Paints the calendar button face.
  function renderCalButton(iso){
    var d = parseISO(iso);
    els.calMonth.textContent = d.toLocaleDateString("en-GB", { month: "short" }).replace(".","").slice(0,3);
    els.calDay.textContent = d.getDate();
    els.calBtn.classList.toggle("is-past", iso !== todayISO());
  }

  /* ============================================================
     FORM RESET / POPULATE
     ============================================================ */
  function clearForm(){
    for (var k in chipState) { if (Object.prototype.hasOwnProperty.call(chipState,k)) delete chipState[k]; }

    document.querySelectorAll(".chip.is-selected").forEach(function(c){
      c.classList.remove("is-selected");
      c.setAttribute("aria-pressed","false");
    });
    document.querySelectorAll(".seg-btn.is-selected").forEach(function(b){
      b.classList.remove("is-selected");
      b.setAttribute("aria-pressed","false");
    });
    document.querySelectorAll(".toggle[aria-checked='true']").forEach(function(t){
      t.setAttribute("aria-checked","false");
    });
    document.querySelectorAll(".check-list input[type=checkbox]:checked").forEach(function(cb){
      cb.checked = false;
    });
    document.querySelectorAll("select").forEach(function(s){ s.selectedIndex = 0; });
    document.querySelectorAll("textarea").forEach(function(t){ t.value = ""; });
    document.querySelectorAll(".field.has-error").forEach(function(f){ clearFieldError(f); });

    existingRowId = null;
    els.saveNote.hidden = true;
    updateConditionals();
  }

  function populateForm(row){
    clearForm();
    if (!row) return;
    existingRowId = row.id || null;

    ALL_FIELDS.forEach(function(name){
      var val = row[name];
      if (val === null || val === undefined || val === "") return;

      var input = document.querySelector('[name="' + name + '"]');
      if (input) { input.value = val; return; }

      // chip group
      var values = Array.isArray(val) ? val : [val];
      chipState[name] = Array.isArray(val) ? values.slice() : val;
      document.querySelectorAll('.chip[data-name="' + name + '"]').forEach(function(chip){
        if (values.indexOf(chip.getAttribute("data-value")) !== -1) {
          chip.classList.add("is-selected");
          chip.setAttribute("aria-pressed","true");
        }
      });
      // seg-btn group
      document.querySelectorAll('.seg-btn[data-name="' + name + '"]').forEach(function(btn){
        if (values.indexOf(btn.getAttribute("data-value")) !== -1) {
          btn.classList.add("is-selected");
          btn.setAttribute("aria-pressed","true");
        }
      });
      // toggle
      document.querySelectorAll('.toggle[data-name="' + name + '"]').forEach(function(tog){
        var isOn = (val === tog.getAttribute("data-value-on"));
        tog.setAttribute("aria-checked", isOn ? "true" : "false");
      });
      // checkbox list
      if (Array.isArray(val)) {
        document.querySelectorAll('input[type=checkbox][data-name="' + name + '"]').forEach(function(cb){
          cb.checked = (val.indexOf(cb.getAttribute("data-value")) !== -1);
        });
      }
    });

    updateConditionals();
  }

  /* ============================================================
     LOAD ENTRY FOR A DATE
     ============================================================ */
  function loadEntryForDate(iso){
    selectedDate = iso;
    els.dateInput.value = iso;
    renderCalButton(iso);
    els.todayBtn.hidden = (iso === todayISO());

    if (!sbClient) {
      clearForm();
      setGreeting("offline");
      return;
    }

    setGreeting("loading");

    sbClient.from(TABLE_NAME)
      .select("*")
      .eq("entry_date", iso)
      .maybeSingle()
      .then(function(res){
        if (res.error) throw res.error;

        if (res.data) {
          populateForm(res.data);
          setGreeting("editing");
        } else {
          clearForm();
          setGreeting("new");
        }
      })
      .catch(function(err){
        console.error("[Tracker] load failed:", err);
        clearForm();
        setGreeting("offline");
      });
  }

  // A <label> click only FOCUSES a date input — it does not open the
  // picker. The picker must be opened explicitly.
  function openDatePicker(){
    var el = els.dateInput;
    try {
      if (typeof el.showPicker === "function") { el.showPicker(); return; }
    } catch (err) {
      // showPicker() throws unless called from a user gesture — fall through
    }
    el.focus();
    try { el.click(); } catch (err) {}
  }

  function initDateControl(){
    var t = todayISO();

    // open the picker when the calendar tile is tapped
    els.calBtn.addEventListener("click", function(e){
      // the tap already landed on the input itself — let it behave natively
      if (e.target === els.dateInput) return;
      e.preventDefault();
      openDatePicker();
    });

    els.dateInput.max = t;               // no future dates
    els.dateInput.min = "2020-01-01";
    els.dateInput.value = t;

    els.dateInput.addEventListener("change", function(){
      var picked = els.dateInput.value;
      if (!picked) { els.dateInput.value = selectedDate; return; }

      if (picked > todayISO()) {          // extra guard for browsers ignoring max
        els.dateInput.value = todayISO();
        showToast("Future dates aren't available", true);
        loadEntryForDate(todayISO());
        return;
      }
      hideDone();
      goToStep(1);
      loadEntryForDate(picked);
    });

    els.todayBtn.addEventListener("click", function(){
      hideDone();
      goToStep(1);
      loadEntryForDate(todayISO());
    });
  }

  /* ============================================================
     CHIPS + SEGMENTED + TOGGLES + CHECKBOXES
     ============================================================ */
  function initChips(){
    document.addEventListener("click", function(e){

      /* ---- chip ---- */
      var chip = e.target.closest ? e.target.closest(".chip") : null;
      if (chip) {
        e.preventDefault();
        var name    = chip.getAttribute("data-name");
        var value   = chip.getAttribute("data-value");
        var isMulti = chip.getAttribute("data-multi") === "1";
        var group   = chip.closest(".chips");
        if (!name || !group) return;

        if (isMulti) {
          chip.classList.toggle("is-selected");
          var picked = [];
          group.querySelectorAll(".chip.is-selected").forEach(function(c){
            picked.push(c.getAttribute("data-value"));
          });
          chipState[name] = picked;
        } else {
          group.querySelectorAll(".chip").forEach(function(c){
            c.classList.remove("is-selected");
            c.setAttribute("aria-pressed","false");
          });
          chip.classList.add("is-selected");
          chip.setAttribute("aria-pressed","true");
          chipState[name] = value;
        }

        if (navigator.vibrate) { try { navigator.vibrate(8); } catch(x){} }
        clearFieldError(chip.closest(".field"));
        updateConditionals();
        return;
      }

      /* ---- segmented button ---- */
      var segBtn = e.target.closest ? e.target.closest(".seg-btn") : null;
      if (segBtn) {
        e.preventDefault();
        var name  = segBtn.getAttribute("data-name");
        var value = segBtn.getAttribute("data-value");
        var group = segBtn.closest(".seg");
        if (!name || !group) return;

        group.querySelectorAll(".seg-btn").forEach(function(b){
          b.classList.remove("is-selected");
          b.setAttribute("aria-pressed","false");
        });
        segBtn.classList.add("is-selected");
        segBtn.setAttribute("aria-pressed","true");
        chipState[name] = value;

        if (navigator.vibrate) { try { navigator.vibrate(8); } catch(x){} }
        clearFieldError(segBtn.closest(".field"));
        updateConditionals();
        return;
      }

      /* ---- toggle switch ---- */
      var toggle = e.target.closest ? e.target.closest(".toggle") : null;
      if (toggle) {
        e.preventDefault();
        var name     = toggle.getAttribute("data-name");
        var valueOn  = toggle.getAttribute("data-value-on");
        var valueOff = toggle.getAttribute("data-value-off");
        var isOn     = toggle.getAttribute("aria-checked") !== "true";
        toggle.setAttribute("aria-checked", isOn ? "true" : "false");
        chipState[name] = isOn ? valueOn : valueOff;
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch(x){} }
        updateConditionals();
        return;
      }
    });

    /* ---- checkbox list (change, not click) ---- */
    document.addEventListener("change", function(e){
      var cb = e.target;
      if (!cb || cb.type !== "checkbox" || !cb.getAttribute("data-name")) return;
      var name  = cb.getAttribute("data-name");
      var group = cb.closest(".check-list");
      if (!group) return;
      var picked = [];
      group.querySelectorAll("input[type=checkbox]:checked").forEach(function(c){
        picked.push(c.getAttribute("data-value"));
      });
      chipState[name] = picked;
      updateConditionals();
    });
  }

  /* ============================================================
     CONDITIONALS
     ============================================================ */
  function updateConditionals(){
    document.querySelectorAll(".field.conditional").forEach(function(field){
      var dependsOn = field.getAttribute("data-show-if");
      var hideWhen  = field.getAttribute("data-show-unless");
      var current   = chipState[dependsOn];

      var show = false;
      if (current !== undefined && current !== null && current !== "") {
        show = Array.isArray(current)
          ? (current.length > 0 && current.indexOf(hideWhen) === -1)
          : (current !== hideWhen);
      }

      var wasHidden = field.hidden;
      field.hidden = !show;

      if (!show && !wasHidden) {
        var name = field.getAttribute("data-field");
        delete chipState[name];
        field.querySelectorAll(".chip.is-selected").forEach(function(c){
          c.classList.remove("is-selected");
          c.setAttribute("aria-pressed","false");
        });
      }
    });
  }

  /* ============================================================
     VALIDATION
     ============================================================ */
  function clearFieldError(field){
    if (!field) return;
    field.classList.remove("has-error");
    var err = field.querySelector(".err");
    if (err) err.hidden = true;
  }

  function showFieldError(field,msg){
    if (!field) return;
    field.classList.add("has-error");
    var err = field.querySelector(".err");
    if (err){ err.textContent = msg || "Please choose an option."; err.hidden = false; }
  }

  function fieldEl(name){ return document.querySelector('.field[data-field="'+name+'"]'); }

  function validateStep(step){
    var required = REQUIRED[step] || [];
    var firstBad = null;

    required.forEach(function(name){
      var field = fieldEl(name);
      if (!field || field.hidden) return;

      var value;
      var select = field.querySelector("select");
      if (select) value = select.value;
      else {
        value = chipState[name];
        if (Array.isArray(value)) value = value.length ? value : "";
      }

      if (!value){ showFieldError(field); if (!firstBad) firstBad = field; }
      else clearFieldError(field);
    });

    if (firstBad){
      try { firstBad.scrollIntoView({behavior:"smooth", block:"center"}); } catch(e){}
      if (navigator.vibrate) { try { navigator.vibrate([12,60,12]); } catch(x){} }
      return false;
    }
    return true;
  }

  document.addEventListener("change", function(e){
    if (e.target.matches && e.target.matches("select, textarea")) {
      clearFieldError(e.target.closest(".field"));
    }
  });

  /* ============================================================
     NAVIGATION
     ============================================================ */
  function goToStep(n, direction){
    currentStep = Math.min(Math.max(n,1), TOTAL_STEPS);

    els.steps.forEach(function(s){
      s.classList.remove("is-active","back");
      if (Number(s.getAttribute("data-step")) === currentStep){
        s.classList.add("is-active");
        if (direction === "back") s.classList.add("back");
      }
    });

    els.progressFill.style.width = ((currentStep/TOTAL_STEPS)*100) + "%";
    els.progressLabel.textContent = "Step " + currentStep + " of " + TOTAL_STEPS;
    els.progressSection.textContent = STEP_NAMES[currentStep-1];
    els.progressBar.setAttribute("aria-valuenow", String(currentStep));

    els.backBtn.hidden = (currentStep === 1);

    if (currentStep === TOTAL_STEPS){
      els.nextBtn.innerHTML = (existingRowId ? "Update Entry " : "Save Entry ") + ICON_CHECK;
      buildReview();
    } else {
      els.nextBtn.innerHTML = "Next " + ICON_NEXT;
    }

    try { window.scrollTo({top:0, behavior:"smooth"}); } catch(e){ window.scrollTo(0,0); }
  }


  /* ============================================================
     COLLECT
     ============================================================ */
  function getValue(name){
    var input = document.querySelector('[name="'+name+'"]');
    if (input){
      var field = input.closest(".field");
      if (field && field.hidden) return null;
      var v = input.value ? input.value.trim() : "";
      return v || null;
    }
    // Toggle: if never interacted with, read from aria-checked directly
    var tog = document.querySelector('.toggle[data-name="'+name+'"]');
    if (tog) {
      var field = tog.closest(".field");
      if (field && field.hidden) return null;
      // Only record if it was explicitly set (stored in chipState)
      var cv = chipState[name];
      if (cv !== undefined) return cv;
      // Not touched — return off value as default (No)
      return tog.getAttribute("data-value-off") || null;
    }
    var cv = chipState[name];
    if (cv === undefined || cv === null) return null;
    if (Array.isArray(cv)) return cv.length ? cv : null;
    return cv || null;
  }

  function collectData(){
    var data = { entry_date: selectedDate };
    ALL_FIELDS.forEach(function(n){ data[n] = getValue(n); });
    return data;
  }

  /* ============================================================
     REVIEW
     ============================================================ */
  function escapeHtml(s){
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function buildReview(){
    els.reviewList.innerHTML = "";
    SECTIONS.forEach(function(sec){
      var filled = [];
      sec.fields.forEach(function(f){
        var v = getValue(f);
        if (v !== null && v !== "") filled.push(v);
      });

      var complete = filled.length > 0;
      var summary = filled.map(function(v){
        return Array.isArray(v) ? v.join(", ") : v;
      }).join(" · ") || "Not filled";

      var row = document.createElement("button");
      row.type = "button";
      row.className = "review-row";
      row.innerHTML =
        '<span class="review-check' + (complete ? "" : " is-empty") + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
          'stroke-linecap="round" stroke-linejoin="round"><path d="' +
          (complete ? "M20 6.5 9.6 17 4 11.5" : "M12 5v14M5 12h14") + '"/></svg></span>' +
        '<span class="review-body">' +
          '<span class="review-name">' + escapeHtml(sec.name) + '</span>' +
          '<span class="review-summary">' + escapeHtml(summary) + '</span>' +
        '</span><span class="review-edit">Edit</span>';

      row.addEventListener("click", function(){ goToStep(sec.step,"back"); });
      els.reviewList.appendChild(row);
    });
  }

  /* ============================================================
     TOAST / NOTE
     ============================================================ */
  var toastTimer;
  function showToast(msg, isError){
    clearTimeout(toastTimer);
    els.toastMsg.textContent = msg;
    els.toast.classList.toggle("is-error", !!isError);
    els.toast.hidden = false;
    requestAnimationFrame(function(){ els.toast.classList.add("is-visible"); });
    toastTimer = setTimeout(function(){
      els.toast.classList.remove("is-visible");
      setTimeout(function(){ els.toast.hidden = true; }, 280);
    }, 3200);
  }

  function setSaveNote(msg, ok){
    els.saveNote.textContent = msg;
    els.saveNote.className = "save-note " + (ok ? "is-ok" : "is-error");
    els.saveNote.hidden = false;
  }

  /* ============================================================
     DONE SCREEN
     ============================================================ */
  function showDone(wasUpdate){
    var s = SLOGANS[Math.floor(Math.random()*SLOGANS.length)];
    els.doneEyebrow.textContent = wasUpdate ? "Entry updated" : "Entry saved";
    els.doneSlogan.textContent = s.line;
    els.doneSub.textContent = s.sub + "  ·  " + prettyDate(selectedDate);
    els.doneScreen.hidden = false;
    if (navigator.vibrate) { try { navigator.vibrate([10,40,18]); } catch(x){} }
  }

  function hideDone(){ els.doneScreen.hidden = true; }


  /* ============================================================
     SAVE
     ============================================================ */
  function handleSave(){
    els.saveNote.hidden = true;

    if (!libLoaded){
      setSaveNote("The Supabase library did not load. Check your connection and refresh.");
      showToast("Library not loaded", true);
      return;
    }
    if (!isConfigured || !sbClient){
      setSaveNote("Supabase is not configured yet. Open js/app.js and set SUPABASE_URL and SUPABASE_ANON_KEY.");
      showToast("Not connected", true);
      return;
    }

    var wasUpdate = !!existingRowId;
    var payload = collectData();

    els.nextBtn.disabled = true;
    els.nextBtn.textContent = "Saving…";

    sbClient.from(TABLE_NAME)
      .upsert(payload, { onConflict: "entry_date" })
      .select()
      .then(function(res){
        if (res.error) throw res.error;
        if (res.data && res.data[0]) existingRowId = res.data[0].id;

        els.nextBtn.disabled = false;
        els.nextBtn.innerHTML = "Update Entry " + ICON_CHECK;
        setGreeting("editing");
        showDone(wasUpdate);
      })
      .catch(function(err){
        console.error("[Tracker] save failed:", err);
        setSaveNote("Could not save: " + (err.message || "unknown error") +
          ". Check your Supabase keys and that the SQL setup was run.");
        showToast("Save failed", true);
        els.nextBtn.disabled = false;
        els.nextBtn.innerHTML = (existingRowId ? "Update Entry " : "Save Entry ") + ICON_CHECK;
      });
  }

  /* ============================================================
     KEYBOARD
     ============================================================ */
  document.addEventListener("keydown", function(e){
    if (!els.doneScreen.hidden && e.key === "Escape"){ hideDone(); return; }
    if (e.key === "Enter" && e.target.matches && !e.target.matches("textarea, button, input")){
      e.preventDefault();
      els.nextBtn.click();
    }
  });

  /* ============================================================
     INIT
     ============================================================ */
  function initButtons(){
    els.nextBtn.addEventListener("click", function(){
      if (currentStep === TOTAL_STEPS){ handleSave(); return; }
      if (!validateStep(currentStep)) return;
      goToStep(currentStep+1, "forward");
    });

    els.backBtn.addEventListener("click", function(){ goToStep(currentStep-1, "back"); });

    els.doneEditBtn.addEventListener("click", function(){ hideDone(); goToStep(1); });

    els.doneNewBtn.addEventListener("click", function(){
      hideDone();
      goToStep(1);
      openDatePicker();
    });
  }

  try {
    initButtons();
    initDateControl();
    initChips();
    goToStep(1);
    loadEntryForDate(todayISO());
    console.log("[Tracker] ready \u2014 v2");
  } catch(e){
    fatal("Something went wrong starting the app: " + e.message);
    throw e;
  }

  if (!libLoaded) console.warn("[Tracker] Supabase library not loaded — saving disabled.");
  else if (!isConfigured) console.warn("[Tracker] Add your Supabase URL and anon key in js/app.js.");
})();
