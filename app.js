const SUPABASE_URL="https://jhipuzlapddqvpmypulc.supabase.co";
const SUPABASE_KEY="sb_publishable_3zOehYy0-IpKXbbM7gHPWw_OiAQ81Aq";
const $=id=>document.getElementById(id);
const book=$("book"),account=$("account"),status=$("status"),resultCard=$("resultCard"),detailsCard=$("detailsCard");
let accessToken=sessionStorage.getItem("gis_access_token"),adminEmail=sessionStorage.getItem("gis_admin_email"),lastCoords=null;
function setStatus(el,msg,type=""){el.textContent=msg;el.className="status"+(type?` ${type}`:"")}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2400)}
async function rest(path,opt={},token=SUPABASE_KEY){const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...opt,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(opt.headers||{})}});const t=await r.text();if(!r.ok)throw Error(t||`HTTP ${r.status}`);return t?JSON.parse(t):[]}
async function pagedSelect(path,token=SUPABASE_KEY){let out=[],from=0,step=1000;while(true){const d=await rest(path,{headers:{Range:`${from}-${from+step-1}`}},token);out.push(...d);if(d.length<step)break;from+=step;if(from>50000)break}return out}
async function countRows(token=SUPABASE_KEY){const r=await fetch(`${SUPABASE_URL}/rest/v1/locations?select=id`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,Prefer:"count=exact",Range:"0-0"}});if(!r.ok)throw Error("Count failed");const cr=r.headers.get("content-range")||"";const m=cr.match(/\/(\d+)$/);return m?Number(m[1]):0}
let bookOptions=[], accountOptions=[];

async function loadBooks(){
  setStatus(status,'Loading Book No…');
  book.disabled=true;
  try{
    const d=await pagedSelect('locations?select=%22Book%20No%22');
    const v=[...new Set(d.map(x=>String(x['Book No']??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    bookOptions=v;
    book.innerHTML='<option value="">Select Book No</option>';
    v.forEach(x=>book.appendChild(new Option(x,x)));
    book.disabled=false;
    $('publicBookCount').textContent=v.length.toLocaleString();
    $('kmlCount').textContent=v.length.toLocaleString();
    setStatus(status,v.length?`${v.length.toLocaleString()} Book No available.`:'No Book No available.',v.length?'success':'');
  }catch(e){
    console.error('loadBooks',e);
    book.value='';
    book.placeholder='Unable to load Book No';
    book.disabled=true;
    setStatus(status,'Unable to load Book No. Please refresh and try again.','error');
  }
}

async function loadAccountsForBook(){
  account.innerHTML='<option value="">Select Book No first</option>';
  account.disabled=true;
  hideResult();
  const b=book.value.trim();
  if(!b)return;
  account.innerHTML='<option value="">Loading Account No…</option>';
  try{
    const d=await pagedSelect(`locations?select=%22Account%20No%22&%22Book%20No%22=eq.${encodeURIComponent(b)}`);
    const v=[...new Set(d.map(x=>String(x['Account No']??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    accountOptions=v;
    account.innerHTML='<option value="">Select Account No</option>';
    v.forEach(x=>account.appendChild(new Option(x,x)));
    account.disabled=false;
    setStatus(status,`${v.length} Account No available.`,v.length?'success':'error');
  }catch(e){
    console.error('load accounts',e);
    account.value='';
    account.placeholder='Unable to load Account No';
    account.disabled=true;
    setStatus(status,'Unable to load Account No. Please try again.','error');
  }
}

book.addEventListener('change',loadAccountsForBook);
account.addEventListener('change',()=>{ if(account.value.trim()) setStatus(status,`Account No ${account.value.trim()} selected.`,'success'); });

function hideResult(){resultCard.hidden=true;detailsCard.hidden=true;$("mapEmpty").hidden=false;$("mapPin").hidden=true;$("mapLabel").hidden=true;$("mapCoords").textContent="No location selected"}
function saveHistory(b,a){let h=JSON.parse(localStorage.getItem("gis_history")||"[]");h=h.filter(x=>!(x.b===b&&x.a===a));h.unshift({b,a,t:Date.now()});localStorage.setItem("gis_history",JSON.stringify(h.slice(0,8)));renderHistory();renderQuick()}
function renderHistory(){const h=JSON.parse(localStorage.getItem("gis_history")||"[]"),box=$("historyList");if(!h.length){box.innerHTML='<div class="empty-history">No searches yet</div>';return}box.innerHTML=h.map(x=>`<div class="history-item" data-b="${esc(x.b)}" data-a="${esc(x.a)}"><div class="history-pin">⌖</div><div class="history-main"><b>${esc(x.b)} - ${esc(x.a)}</b><small>${timeAgo(x.t)}</small></div><span>›</span></div>`).join("");box.querySelectorAll(".history-item").forEach(el=>el.onclick=()=>useSearch(el.dataset.b,el.dataset.a))}
function renderQuick(){const h=JSON.parse(localStorage.getItem("gis_history")||"[]").slice(0,5),box=$("quickSearches");box.innerHTML=h.length?h.map(x=>`<span class="chip" data-b="${esc(x.b)}" data-a="${esc(x.a)}">${esc(x.b)}-${esc(x.a)}</span>`).join(""):'<span class="chip muted">No recent searches</span>';box.querySelectorAll(".chip:not(.muted)").forEach(c=>c.onclick=()=>useSearch(c.dataset.b,c.dataset.a))}
function timeAgo(ts){const m=Math.max(1,Math.floor((Date.now()-ts)/60000));return m<60?`${m} minute${m===1?'':'s'} ago`:m<1440?`${Math.floor(m/60)} hour${Math.floor(m/60)===1?'':'s'} ago`:`${Math.floor(m/1440)} day${Math.floor(m/1440)===1?'':'s'} ago`}
function esc(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function useSearch(b,a){
  book.value=b;
  await loadAccountsForBook();
  account.value=a;
  await searchLocation();
}
async function searchLocation(){if(!book.value||!account.value){setStatus(status,"Please select Book No and Account No.","error");return}setStatus(status,"Searching location…");hideResult();try{const d=await rest(`locations?select=%22Latitude%22,%22Longitude%22&%22Book%20No%22=eq.${encodeURIComponent(book.value)}&%22Account%20No%22=eq.${encodeURIComponent(account.value)}&limit=1`);if(!d.length)throw Error("Location not found");lastCoords={lat:Number(d[0]["Latitude"]),lon:Number(d[0]["Longitude"])};$("resultText").textContent=`Book No: ${book.value}  |  Account No: ${account.value}`;$("detailBook").textContent=book.value;$("detailAccount").textContent=account.value;$("detailLat").textContent=lastCoords.lat.toFixed(8);$("detailLon").textContent=lastCoords.lon.toFixed(8);$("mapCoords").textContent=`Latitude ${lastCoords.lat.toFixed(8)}   •   Longitude ${lastCoords.lon.toFixed(8)}`;$("mapEmpty").hidden=true;$("mapPin").hidden=false;$("mapLabel").hidden=false;$("mapLabel").textContent=`Book ${book.value} · Acc ${account.value}`;resultCard.hidden=false;detailsCard.hidden=false;$("foundCount").textContent=(Number($("foundCount").textContent)||0)+1;setStatus(status,"Location found successfully. Opening Google Maps…","success");saveHistory(book.value,account.value);toast("Opening Google Maps");openMap();}catch(e){setStatus(status,"Location not found. Please check your selection.","error");toast("Location not found")}}
$("search").onclick=searchLocation;$("mapBtn").onclick=()=>openMap();$("mapBtn2").onclick=()=>openMap();$("fullMapBtn").onclick=()=>openMap();
function openMap(){if(lastCoords)window.open(`https://www.google.com/maps/search/?api=1&query=${lastCoords.lat},${lastCoords.lon}`,"_blank")}
$("copyBtn").onclick=async()=>{if(!lastCoords)return;await navigator.clipboard.writeText(`${lastCoords.lat}, ${lastCoords.lon}`);toast("Coordinates copied")};$("clearHistory").onclick=()=>{localStorage.removeItem("gis_history");renderHistory();renderQuick();toast("Search history cleared")};
function openSettings(){$("settingsPanel").hidden=false}function closeSettings(){$("settingsPanel").hidden=true}$("settingsBtn").onclick=openSettings;$("closeSettings").onclick=closeSettings;$("mSettings").onclick=openSettings;
function setTheme(){const dark=document.body.classList.toggle("dark");localStorage.setItem("gis_theme",dark?"dark":"light")};if(localStorage.getItem("gis_theme")==="dark")document.body.classList.add("dark");$("themeToggle").onclick=setTheme;$("themeToggleTop").onclick=setTheme;
function navActive(id){document.querySelectorAll(".side-item").forEach(x=>x.classList.remove("active"));$(id)?.classList.add("active")}
$("homeNav").onclick=()=>{navActive("homeNav");window.scrollTo({top:0,behavior:"smooth"})};$("findNav").onclick=()=>{navActive("findNav");$("book").focus()};$("historyNav").onclick=()=>{navActive("historyNav");$("historyList").scrollIntoView({behavior:"smooth"})};$("helpNav").onclick=()=>toast("Use Book No → Account No → Search Location");$("mHome").onclick=()=>window.scrollTo({top:0,behavior:"smooth"});$("mFind").onclick=()=>$("book").focus();$("mHistory").onclick=()=>$("historyList").scrollIntoView({behavior:"smooth"});
const loginBox=$("loginBox"),adminBox=$("adminBox"),upstatus=$("upstatus"),adminStatus=$("adminStatus"),delBook=$("deleteBook"),delStatus=$("deleteStatus");
function showAdmin(v){loginBox.hidden=v;adminBox.hidden=!v;if(v){$("who").textContent=`Logged in as ${adminEmail}`;loadAdminData()}}
async function loginAdmin(){setStatus(upstatus,"Signing in…");try{const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:$("email").value.trim(),password:$("pass").value})});const d=await r.json();if(!r.ok)throw Error(d.error_description||d.msg||"Login failed");accessToken=d.access_token;adminEmail=$("email").value.trim();sessionStorage.setItem("gis_access_token",accessToken);sessionStorage.setItem("gis_admin_email",adminEmail);showAdmin(true);setStatus(upstatus,"Admin login successful.","success");toast("Admin login successful")}catch(e){setStatus(upstatus,"Login failed. Check email/password.","error")}}
$("loginBtn").onclick=loginAdmin;$("logout").onclick=()=>{accessToken=null;adminEmail=null;sessionStorage.removeItem("gis_access_token");sessionStorage.removeItem("gis_admin_email");showAdmin(false);setStatus(upstatus,"Logged out successfully.","success");toast("Logged out")};
async function storageUpload(file,token){const path=encodeURIComponent(file.name);const r=await fetch(`${SUPABASE_URL}/storage/v1/object/kml-files/${path}`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":file.type||"application/vnd.google-earth.kml+xml","x-upsert":"false"},body:file});const t=await r.text();if(!r.ok)throw Error(t||`Storage upload failed (HTTP ${r.status})`);return t?JSON.parse(t):{}}
async function storageDelete(bookNo,token){const path=encodeURIComponent(bookNo+".kml");const r=await fetch(`${SUPABASE_URL}/storage/v1/object/kml-files/${path}`,{method:"DELETE",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});const t=await r.text();if(!r.ok)throw Error(t||`Storage delete failed (HTTP ${r.status})`);return t?JSON.parse(t):{}}
function parseKml(t,b){const x=new DOMParser().parseFromString(t,"application/xml"),o=[];if(x.querySelector("parsererror"))throw Error("Invalid KML/XML");[...x.getElementsByTagName("Placemark")].forEach(p=>{let a="";[...p.getElementsByTagName("SimpleData")].some(n=>{let k=(n.getAttribute("name")||"").toLowerCase(),v=n.textContent.trim();if(/account|consumer|customer|acct|acc/.test(k)&&v){a=v;return true}return false});if(!a)a=(p.getElementsByTagName("name")[0]?.textContent||"").trim();let c=p.getElementsByTagName("coordinates")[0]?.textContent.trim().split(/\s+/)[0];if(a&&c){let q=c.split(","),lon=+q[0],lat=+q[1];if(Number.isFinite(lat)&&Number.isFinite(lon))o.push({"Book No":b,"Account No":a,"Latitude":lat,"Longitude":lon})}});return o}
async function loadAdminData(){try{const d=await pagedSelect('locations?select=%22Book%20No%22&order=%22Book%20No%22.asc',accessToken),v=[...new Set(d.map(x=>x["Book No"]).filter(Boolean))];delBook.innerHTML='<option value="">Select Book No</option>';v.forEach(x=>delBook.add(new Option(x,x)));$("bookCount").textContent=v.length.toLocaleString();const c=await countRows(accessToken);$("locationCount").textContent=c.toLocaleString();$("publicLocationCount").textContent=c.toLocaleString()}catch(e){$("bookCount").textContent="—";$("locationCount").textContent="—"}}
$("upload").onclick=async()=>{let f=$("file").files[0];if(!f)return setStatus(adminStatus,"Select a KML file first.","error");if(!accessToken)return setStatus(adminStatus,"Please login as Admin first.","error");try{let b=f.name.replace(/\.[^.]+$/g,"").trim(),rows=parseKml(await f.text(),b);if(!rows.length)throw Error("No locations found in KML");setStatus(adminStatus,`Replacing Book No ${b}…`);await rest(`locations?%22Book%20No%22=eq.${encodeURIComponent(b)}`,{method:"DELETE",headers:{Prefer:"return=minimal"}},accessToken);try{await storageDelete(b,accessToken)}catch(e){if(!/404|not found/i.test(e.message))throw e}await storageUpload(f,accessToken);for(let i=0;i<rows.length;i+=200)await rest("locations",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(rows.slice(i,i+200))},accessToken);$("file").value="";setStatus(adminStatus,`Book No ${b} replaced successfully. ${rows.length} locations saved.` ,"success");toast(`Book ${b} updated`);await loadBooks();await loadAdminData()}catch(e){setStatus(adminStatus,"Upload failed: "+e.message,"error")}};
$("deleteBtn").onclick=async()=>{let b=delBook.value;if(!b)return setStatus(delStatus,"Select Book No first.","error");if(!confirm(`Delete Book No ${b} from database and Storage?`))return;setStatus(delStatus,"Deleting…");try{await rest(`locations?%22Book%20No%22=eq.${encodeURIComponent(b)}`,{method:"DELETE",headers:{Prefer:"return=minimal"}},accessToken);try{await storageDelete(b,accessToken)}catch(e){if(!/404|not found/i.test(e.message))throw e}setStatus(delStatus,`Book No ${b} deleted successfully.` ,"success");toast(`Book ${b} deleted`);await loadBooks();await loadAdminData()}catch(e){setStatus(delStatus,"Delete failed: "+e.message,"error")}};
$("year").textContent=new Date().getFullYear();renderHistory();renderQuick();showAdmin(!!accessToken);loadBooks();countRows().then(c=>$("publicLocationCount").textContent=c.toLocaleString()).catch(()=>{});
