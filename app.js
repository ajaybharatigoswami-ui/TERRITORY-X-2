(function(){"use strict";
var SU="",SK="";
var SAT_MAXZ=17,MAP_MAXZ=19;
var STYLE={version:8,sources:{sat:{type:"raster",tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:SAT_MAXZ,attribution:"Tiles &copy; Esri"},osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,maxzoom:19,attribution:"&copy; OpenStreetMap contributors"},lbl:{type:"raster",tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:19}},layers:[{id:"sat",type:"raster",source:"sat"},{id:"osm",type:"raster",source:"osm",layout:{visibility:"none"}},{id:"lbl",type:"raster",source:"lbl"}]};
var S=0.004,FS=0.00025,MIN_ACC=30,CLAIM_ACC=15,MAX_SPEED=7.5,MIN_RUN_M=20,MAX_SEG=60;
var B=[{n:"Enchanted Forest",w:"Woods",c:"#35d07f",e:"\u{1F332}"},{n:"Dragon Mountains",w:"Peaks",c:"#8e7dff",e:"\u{1F409}"},{n:"Golden Desert",w:"Dunes",c:"#ffc247",e:"\u{1F335}"},{n:"Fire Kingdom",w:"Caldera",c:"#ff5a36",e:"\u{1F525}"},{n:"Mystic Swamp",w:"Bog",c:"#5b8c5a",e:"\u{1F438}"},{n:"Crystal Lake",w:"Lake",c:"#3cc8ff",e:"\u{1F48E}"},{n:"Snow Kingdom",w:"Tundra",c:"#bfe9ff",e:"\u2744\uFE0F"},{n:"Ancient Ruins",w:"Ruins",c:"#c9a27a",e:"\u{1F3DB}\uFE0F"},{n:"Magical Islands",w:"Isles",c:"#ff7ac8",e:"\u{1F3DD}\uFE0F"}];
var ADJ=["Whisper","Ember","Silver","Hollow","Storm","Gilded","Mist","Crown"];
var COLORS=["#ff4d8d","#ffd23f","#3cc8ff","#7cff6b","#b57bff","#ff8a3d"];
var $=function(i){return document.getElementById(i)};
var save;try{save=JSON.parse(localStorage.getItem("tx1"))}catch(e){}
save=save||{color:COLORS[0],name:"Explorer",dist:0,claimed:{},runs:[]};
Object.keys(save.claimed).forEach(function(k){if(k.indexOf("t:")!==0)delete save.claimed[k]});
var pid=null;try{pid=localStorage.getItem("txp")}catch(e){}
if(!pid){pid="p"+Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem("txp",pid)}catch(e){}}
function persist(){try{localStorage.setItem("tx1",JSON.stringify(save));return true}catch(e){return false}}
function hsh(a,b){var x=Math.imul(a,374761393)^Math.imul(b,668265263);x=Math.imul(x^(x>>>13),1274126177);return(x^(x>>>16))>>>0}
function bio(x,y){return hsh(Math.floor(x/4),Math.floor(y/4))%B.length}
function tbio(tx,ty){return bio(Math.floor(tx/16),Math.floor(ty/16))}
function cname(x,y){return ADJ[hsh(x,y)%8]+" "+B[bio(x,y)].w}
function cor(i,j){var h=hsh(i*7+1,j*13+3);return[(i+((h&255)/255-.5)*.4)*S,(j+(((h>>8)&255)/255-.5)*.4)*S]}
function hav(a,b){var R=6371000,r=Math.PI/180,dl=(b[1]-a[1])*r,dn=(b[0]-a[0])*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(x))}
function fmt(ms){var s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);s%=60;m%=60;var p=function(n){return(n<10?"0":"")+n};return(h?h+":":"")+p(m)+":"+p(s)}
function toast(t){var e=$("toast");e.textContent=t;e.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.remove("on")},3200)}
var map=new maplibregl.Map({container:"map",style:STYLE,center:[77.209,28.6139],zoom:14,maxZoom:MAP_MAXZ,attributionControl:{compact:true}});
map.addControl(new maplibregl.ScaleControl({unit:"metric"}),"bottom-left");
var streetMode=false,satErr=0,lastErr=0,warned=false;
function basemap(street){streetMode=street;var v=function(id,on){if(map.getLayer(id))map.setLayoutProperty(id,"visibility",on?"visible":"none")};v("sat",!street);v("lbl",!street);v("osm",street)}
map.on("error",function(e){if(streetMode||!e||e.sourceId!=="sat")return;var st=e.error&&e.error.status;if(st!==400&&st!==403&&st!==404)return;
  var n=Date.now();if(n-lastErr>10000)satErr=0;lastErr=n;satErr++;
  if(satErr>=4){basemap(true);toast("Satellite yahan available nahi - Street map chalu")}});
map.on("moveend",function(){var z=map.getZoom();
  if(streetMode&&z<=15.5){satErr=0;basemap(false);toast("Satellite wapas chalu")}
  if(!warned&&!streetMode&&z>SAT_MAXZ+1){warned=true;toast("Itna zoom: satellite photo stretch hogi (blurry)")}});
var empty={type:"FeatureCollection",features:[]};
var others={},vb=null,me=null,follow=true,first=true,run=null,wake=null,lt=null,bt=null,flushing=false,lastSave=0;
function icon(i){var s=64,c=document.createElement("canvas");c.width=c.height=s;var x=c.getContext("2d"),g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,"#ffffff");g.addColorStop(1,B[i].c);x.beginPath();x.moveTo(32,3);x.lineTo(58,13);x.lineTo(56,38);x.quadraticCurveTo(50,56,32,62);x.quadraticCurveTo(14,56,8,38);x.lineTo(6,13);x.closePath();x.fillStyle=g;x.fill();x.lineWidth=4;x.strokeStyle="#ffffff";x.stroke();x.font="28px sans-serif";x.textAlign="center";x.textBaseline="middle";x.fillText(B[i].e,32,32);return x.getImageData(0,0,s,s)}
function setup(){
  for(var i=0;i<B.length;i++)if(!map.hasImage("b"+i))map.addImage("b"+i,icon(i));
  if(!map.getSource("grid")){
    map.addSource("grid",{type:"geojson",data:empty});map.addSource("regions",{type:"geojson",data:empty});map.addSource("tiles",{type:"geojson",data:empty});map.addSource("route",{type:"geojson",data:empty});
    map.addLayer({id:"gl",type:"line",source:"grid",minzoom:15.5,paint:{"line-color":"#ffffff","line-width":.6,"line-opacity":["interpolate",["linear"],["zoom"],15.5,0,17,.22]}});
    map.addLayer({id:"rb",type:"line",source:"regions",filter:["==",["geometry-type"],"LineString"],layout:{"line-cap":"round"},paint:{"line-color":["get","c"],"line-width":2.5,"line-opacity":.55,"line-blur":1.5}});
    map.addLayer({id:"tf",type:"fill",source:"tiles",paint:{"fill-color":["get","c"],"fill-opacity":.45}});
    map.addLayer({id:"tg",type:"line",source:"tiles",paint:{"line-color":["get","c"],"line-width":5,"line-blur":4,"line-opacity":.55}});
    map.addLayer({id:"tl",type:"line",source:"tiles",paint:{"line-color":"#ffffff","line-width":1.2,"line-opacity":.75}});
    map.addLayer({id:"ci",type:"symbol",source:"regions",filter:["==",["geometry-type"],"Point"],layout:{"icon-image":["get","i"],"icon-size":["interpolate",["linear"],["zoom"],12,.3,16,.6],"icon-allow-overlap":true},paint:{"icon-opacity":.85}});
    map.addLayer({id:"rg",type:"line",source:"route",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#ffffff","line-width":9,"line-opacity":.9}});
    map.addLayer({id:"rl",type:"line",source:"route",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#ff2d75","line-width":5}});
  }
  refresh();drawRoute();
}
map.on("style.load",setup);map.on("moveend",refresh);
function refresh(){
  if(map.getZoom()<13){vb=null;build();return}
  var b=map.getBounds(),x0=Math.floor(b.getWest()/S)-1,x1=Math.floor(b.getEast()/S)+1,y0=Math.floor(b.getSouth()/S)-1,y1=Math.floor(b.getNorth()/S)+1;
  vb=(x1-x0)*(y1-y0)>1200?null:{x0:x0,x1:x1,y0:y0,y1:y1,tx0:Math.floor(b.getWest()/FS),tx1:Math.floor(b.getEast()/FS),ty0:Math.floor(b.getSouth()/FS),ty1:Math.floor(b.getNorth()/FS),z:map.getZoom()};
  build();clearTimeout(lt);lt=setTimeout(loadOthers,400)}
function soon(){clearTimeout(bt);bt=setTimeout(build,300)}
function tpoly(tx,ty){return{type:"Polygon",coordinates:[[[tx*FS,ty*FS],[(tx+1)*FS,ty*FS],[(tx+1)*FS,(ty+1)*FS],[tx*FS,(ty+1)*FS],[tx*FS,ty*FS]]]}}
function edge(a,b,c){return{type:"Feature",properties:{c:c},geometry:{type:"LineString",coordinates:[a,b]}}}
function build(){var sg=map.getSource("grid"),sr=map.getSource("regions"),st=map.getSource("tiles");if(!sg||!sr||!st)return;
  if(!vb){sg.setData(empty);sr.setData(empty);st.setData(empty);return}
  var f=[],t=[],g=[],x,y,bi;
  for(x=vb.x0;x<=vb.x1;x++)for(y=vb.y0;y<=vb.y1;y++){bi=bio(x,y);
    if(bio(x+1,y)!==bi)f.push(edge(cor(x+1,y),cor(x+1,y+1),B[bi].c));
    if(bio(x,y+1)!==bi)f.push(edge(cor(x,y+1),cor(x+1,y+1),B[bi].c));
    if(((x%4)+4)%4===1&&((y%4)+4)%4===1)f.push({type:"Feature",properties:{i:"b"+bi},geometry:{type:"Point",coordinates:[(x+.5)*S,(y+.5)*S]}})}
  if(vb.z>=15.5&&(vb.tx1-vb.tx0)+(vb.ty1-vb.ty0)<500){
    for(x=vb.tx0;x<=vb.tx1+1;x++)g.push(edge([x*FS,vb.ty0*FS],[x*FS,(vb.ty1+1)*FS],"#fff"));
    for(y=vb.ty0;y<=vb.ty1+1;y++)g.push(edge([vb.tx0*FS,y*FS],[(vb.tx1+1)*FS,y*FS],"#fff"))}
  [[save.claimed,1],[others,0]].forEach(function(pair){var src=pair[0],mine=pair[1];
    Object.keys(src).forEach(function(k){var p=k.slice(2).split(","),tx=+p[0],ty=+p[1];
      if(tx<vb.tx0||tx>vb.tx1||ty<vb.ty0||ty>vb.ty1)return;
      t.push({type:"Feature",properties:{c:mine?B[tbio(tx,ty)].c:(src[k].color||"#ff5a36")},geometry:tpoly(tx,ty)})})});
  sg.setData({type:"FeatureCollection",features:g});sr.setData({type:"FeatureCollection",features:f});st.setData({type:"FeatureCollection",features:t})}
function api(path,opt,pref){opt=opt||{};opt.headers={apikey:SK,Authorization:"Bearer "+SK,"Content-Type":"application/json",Prefer:pref||"return=minimal"};return fetch(SU+"/rest/v1/"+path,opt)}
function loadOthers(){if(!SU||!vb||vb.z<14)return;
  api("claims?select=key,owner,color&key=like.t:*&cx=gte."+vb.tx0+"&cx=lte."+vb.tx1+"&cy=gte."+vb.ty0+"&cy=lte."+vb.ty1+"&limit=1000").then(function(r){return r.json()}).then(function(a){
    if(!Array.isArray(a))return;
    a.forEach(function(r){if(r.owner===pid){if(!save.claimed[r.key])save.claimed[r.key]={t:0,n:"Territory"}}else others[r.key]={owner:r.owner,color:r.color}});
    build();card()}).catch(function(){})}
if(SU)setInterval(loadOthers,20000);
function smooth(a){if(a.length<3)return a;var o=[a[0]];for(var i=0;i<a.length-1;i++){var p=a[i],q=a[i+1];o.push([.75*p[0]+.25*q[0],.75*p[1]+.25*q[1]],[.25*p[0]+.75*q[0],.25*p[1]+.75*q[1]])}o.push(a[a.length-1]);return o}
function drawRoute(){var s=map.getSource("route");if(s)s.setData(run&&run.route.length>1?{type:"Feature",geometry:{type:"LineString",coordinates:smooth(run.route)}}:empty)}
var pin=document.createElement("div");pin.className="pin";var marker=new maplibregl.Marker({element:pin});
function color(){pin.style.background=save.color}color();
map.on("dragstart",function(){follow=false});
function el(){return run?run.ms+(run.st==="run"?Date.now()-run.seg:0):0}
function saveRun(){if(!run)return;try{localStorage.setItem("txr",JSON.stringify({dist:run.dist,ms:el(),start:run.start,route:run.route.slice(-3000),n:run.n,q:run.q}))}catch(e){}persist()}
function clearRun(){try{localStorage.removeItem("txr")}catch(e){}}
function maybeSave(){var n=Date.now();if(n-lastSave>2500){lastSave=n;saveRun()}}
try{var rr=JSON.parse(localStorage.getItem("txr"));if(rr&&rr.start){run={st:"pause",dist:rr.dist||0,ms:rr.ms||0,seg:Date.now(),start:rr.start,route:rr.route||[],last:null,n:rr.n||0,q:rr.q||[]};setTimeout(function(){toast("Purani run wapas aayi - RESUME dabao")},1500)}}catch(e){}
function wl(){try{if(navigator.wakeLock)navigator.wakeLock.request("screen").then(function(w){wake=w}).catch(function(){})}catch(e){}}
document.addEventListener("visibilitychange",function(){if(document.hidden){saveRun()}else if(run&&run.st==="run")wl()});
window.addEventListener("pagehide",saveRun);
function claimAt(lng,lat){var tx=Math.floor(lng/FS),ty=Math.floor(lat/FS),k="t:"+tx+","+ty;
  if(save.claimed[k]||others[k])return;
  save.claimed[k]={t:Date.now(),n:cname(Math.floor(tx/16),Math.floor(ty/16))};run.n++;if(SU)run.q.push({key:k,cx:tx,cy:ty});
  if(run.n%10===1){toast("Naya area: "+save.claimed[k].n+" ("+B[tbio(tx,ty)].n+")");if(navigator.vibrate)navigator.vibrate(120)}
  soon();card()}
function claimSeg(p,q){var n=Math.max(1,Math.ceil(hav(p,q)/6));for(var i=1;i<=n;i++)claimAt(p[0]+(q[0]-p[0])*i/n,p[1]+(q[1]-p[1])*i/n)}
function flush(r){r=r||run;if(!SU||!r||!r.q.length||flushing)return Promise.resolve();flushing=true;var b=r.q.slice(0,200);
  return api("claims?on_conflict=key",{method:"POST",body:JSON.stringify(b.map(function(t){return{key:t.key,cx:t.cx,cy:t.cy,owner:pid,owner_name:save.name,color:save.color}}))},"resolution=ignore-duplicates,return=representation").then(function(x){return x.json()}).then(function(a){
    flushing=false;if(!Array.isArray(a))return;var ok={};a.forEach(function(z){ok[z.key]=1});
    b.forEach(function(t){if(!ok[t.key]){delete save.claimed[t.key];r.n--;others[t.key]={owner:"x",color:"#ff5a36"}}});
    r.q=r.q.slice(b.length);build();card()}).catch(function(){flushing=false})}
setInterval(function(){flush()},5000);
function onPos(p){var c=p.coords,a=c.accuracy,ll=[c.longitude,c.latitude],g=$("gps");me=ll;
  g.textContent="GPS \u00B1"+Math.round(a)+"m";g.className="chip "+(a<=CLAIM_ACC?"g":a<=MIN_ACC?"o":"r");
  marker.setLngLat(ll).addTo(map);
  var mx=Math.floor(ll[0]/S),my=Math.floor(ll[1]/S);$("bn").textContent="Current Biome: "+B[bio(mx,my)].n;$("bn").style.borderColor=B[bio(mx,my)].c;
  if(first){first=false;map.jumpTo({center:ll,zoom:16})}else if(follow)map.easeTo({center:ll,duration:700});
  if(!run||run.st!=="run")return;
  if(a>MIN_ACC){toast("GPS weak hai, point ignore kiya");return}
  var pt={ll:ll,t:p.timestamp,a:a};
  if(!run.last){run.last=pt;run.route.push(ll);drawRoute();return}
  var d=hav(run.last.ll,ll),dt=(pt.t-run.last.t)/1000;
  if(d<Math.max(3,a*.3))return;
  if(dt<=0||d/dt>MAX_SPEED){run.last=pt;toast("Speed bahut zyada - count nahi hua");return}
  var prev=run.last.ll,pa=run.last.a;run.dist+=d;run.last=pt;run.route.push(ll);drawRoute();
  if(a<=CLAIM_ACC&&pa<=CLAIM_ACC&&run.dist>=MIN_RUN_M&&d<=MAX_SEG)claimSeg(prev,ll);
  maybeSave();
}
function onErr(e){var g=$("gps");g.className="chip r";g.textContent=e.code===1?"GPS permission band hai":"GPS nahi mila"}
if(navigator.geolocation)navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:0,timeout:20000});else onErr({code:0});
function hud(){$("hDist").textContent=((run?run.dist:0)/1000).toFixed(2);$("hTime").textContent=fmt(el());var h=el()/3600000;$("hSpd").textContent=run&&h>0?(run.dist/1000/h).toFixed(1):"0.0";$("hTer").textContent=run?run.n:0}
setInterval(hud,1000);
function ui(){$("bStart").hidden=!!run;$("bPause").hidden=$("bFin").hidden=!run;$("hud").hidden=!run;if(run)$("bPause").textContent=run.st==="run"?"PAUSE":"RESUME"}
function tiles(){return Object.keys(save.claimed).length}
function area(){var lat=me?me[1]:20,m=FS*111320;return tiles()*m*m*Math.cos(lat*Math.PI/180)/1e6}
function xp(){return Math.round(save.dist/1000*100+tiles()*5)}
function lvl(){return 1+Math.floor(Math.sqrt(xp()/100))}
function card(){var L=lvl(),lo=(L-1)*(L-1)*100,hi=L*L*100,x=xp();
  $("lv").textContent=L;$("pn").textContent=save.name;$("xpb").style.width=Math.min(100,(x-lo)/(hi-lo)*100)+"%";$("px").textContent=x+" / "+hi+" XP";
  $("pd").textContent=(save.dist/1000).toFixed(2)+" km";$("pt").textContent=area().toFixed(3)+" km\u00B2"}
$("bStart").onclick=function(){if(!me){toast("Pehle GPS location milne do");return}
  run={st:"run",dist:0,ms:0,seg:Date.now(),start:Date.now(),route:[],last:null,n:0,q:[]};follow=true;wl();saveRun();ui();hud();drawRoute()};
$("bPause").onclick=function(){if(!run)return;if(run.st==="run"){run.ms+=Date.now()-run.seg;run.st="pause"}else{run.st="run";run.seg=Date.now();run.last=null;wl()}saveRun();ui()};
$("bFin").onclick=function(){if(!run)return;var r=run,ms=el(),km=r.dist/1000,sp=ms>0?km/(ms/3600000):0;
  save.dist+=r.dist;save.runs.unshift({t:r.start,d:Math.round(r.dist),s:Math.round(ms/1000),n:r.n,r:r.route.filter(function(_,i){return i%2===0}).slice(0,1500)});save.runs=save.runs.slice(0,20);
  var ok=persist();clearRun();if(wake){try{wake.release()}catch(e){}wake=null}
  run=null;ui();hud();drawRoute();build();card();flush(r);
  prof();$("mp").innerHTML="<div>"+(ok?"Run save ho gayi":"SAVE NAHI HUA - phone storage check karo")+": "+km.toFixed(2)+" km \u2022 "+fmt(ms)+" \u2022 avg "+sp.toFixed(1)+" km/h \u2022 "+r.n+" naye tiles</div>"+$("mp").innerHTML;$("sheet").hidden=false};
$("bLoc").onclick=function(){follow=true;if(me)map.easeTo({center:me,zoom:Math.max(map.getZoom(),16)});else toast("GPS location abhi nahi mili")};
function prof(){
  $("pName").value=save.name;
  $("sw").innerHTML="";COLORS.forEach(function(c){var b=document.createElement("button");b.style.background=c;b.setAttribute("aria-label","Marker color "+c);if(c===save.color)b.className="on";b.onclick=function(){save.color=c;persist();color();prof()};$("sw").appendChild(b)});
  $("pStats").innerHTML="<div><b>"+(save.dist/1000).toFixed(2)+" km</b>total distance</div><div><b>"+area().toFixed(3)+" km\u00B2</b>area claimed ("+tiles()+" tiles)</div><div><b>"+save.runs.length+"</b>runs saved</div><div><b>Lv "+lvl()+"</b>level</div>";
  $("pRuns").innerHTML=save.runs.slice(0,5).map(function(r){return"<div>"+new Date(r.t).toLocaleDateString()+" \u2022 "+(r.d/1000).toFixed(2)+" km \u2022 "+fmt(r.s*1000)+" \u2022 "+(r.s?(r.d/1000/(r.s/3600)).toFixed(1):0)+" km/h</div>"}).join("")||"<div>Abhi koi run nahi</div>";
  var seen={},names=[];Object.keys(save.claimed).filter(function(k){return save.claimed[k].t}).sort(function(a,b){return save.claimed[b].t-save.claimed[a].t}).forEach(function(k){var n=save.claimed[k].n;if(!seen[n]&&names.length<5){seen[n]=1;names.push(n)}});
  $("pTer").innerHTML=names.map(function(n){return"<div>"+n+"</div>"}).join("")||"<div>Abhi koi territory nahi</div>";
  $("mp").innerHTML="<div>Multiplayer: "+(SU?"ON (Supabase)":"OFF (sirf aapke phone mein)")+"</div>"}
$("bProf").onclick=$("pc").onclick=function(){prof();$("sheet").hidden=false};
$("bClose").onclick=function(){var v=$("pName").value.trim();if(v){save.name=v;persist()}$("sheet").hidden=true;card()};
if("serviceWorker"in navigator)window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})});
ui();hud();card();
})();