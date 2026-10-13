import * as THREE from 'three';
import './style.css';
import { createHuman, animateHuman, SHIRT_COLORS, type Human } from './characters';
import { Ragdoll } from './ragdoll';
import { createMinimap, type MapPoint } from './minimap';
import { createVehicle, dentVehicle, carDamage, repairVehicle, updateVehicleVisuals } from './vehicleVisuals';
import { createVehicleMotion, resetMotion, forwardSpeed, vehicleSpeed as motionSpeed, vehicleOverlapsCircle, vehiclesOverlap, vehicleWorldBlocked, updateDrivenVehicle, driveToward, stepVehiclePhysics, type VehicleMotion, type VehicleImpact, VEHICLE_RADIUS, VEHICLE_HALF_SEGMENT } from './vehiclePhysics';
import { sweptVehicleHit, type VehicleHitPose } from './vehicleHits';
import { vehicleMapHeading } from './mapHeading';
import { inPoliceVisionCone, POLICE_CAR_VISION_RANGE, POLICE_OFFICER_VISION_RANGE, POLICE_VISION_FOV } from './policeVision';

type Save = { cash:number; rep:number; completed:number; upgrades:number };
const defaultSave:Save={cash:100,rep:0,completed:0,upgrades:0};
const validProgress=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
function load():Save{
  const candidates:Partial<Save>[]=[];
  for(const key of ['neon-save','neo777-save']){
    try{
      const parsed:unknown=JSON.parse(localStorage.getItem(key)||'null');
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))candidates.push(parsed as Partial<Save>);
    }catch{/* Invalid or unavailable browser storage falls back to the other compatible key. */}
  }
  const progress={...defaultSave};
  for(const field of Object.keys(defaultSave) as (keyof Save)[]){
    const value=candidates.map(candidate=>candidate[field]).find(validProgress);
    if(value!==undefined)progress[field]=value;
  }
  return progress;
}
const save=load();
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<div id="hud"><div id="brand"><img id="brand-logo" src="/neo777-brand-v08.png?v=8" alt="NeO 777 logo"/><div id="brand-text"><h1>NeO <span>777</span></h1><p>THE CITY NEVER FOLDS · ALPHA 1.2</p></div></div><div id="stats"></div><div id="wanted" aria-live="polite"></div><div id="police-hud" aria-live="polite"></div><div id="health-hud" aria-live="polite"></div><div id="vehicle-hud" aria-live="polite"></div><div id="cover-status" aria-live="polite"></div><div id="mission"></div><div id="hint">WASD move / drive · Shift sprint · E interact / enter / exit car · Space brake · R reset</div><div id="toast"></div></div><div id="cross">+</div><div id="grapple-overlay" hidden><strong id="grapple-title">OFFICER ENGAGED</strong><span id="grapple-instructions">Press F repeatedly to break free!</span><div id="grapple-meter"><span id="grapple-fill"></span></div><small id="grapple-time"></small></div><div id="arrest-overlay" hidden role="alert" aria-live="assertive"><div class="arrest-backdrop"></div><div class="arrest-message"><strong>COOKED</strong><span id="arrest-caption">ARRESTED</span></div></div><aside id="radar" aria-label="Live city minimap"><div id="radar-title"><b>NeO 777</b><span>LIVE GPS</span></div><canvas id="minimap" width="420" height="420" aria-label="Player, police vision cones, shops, bridges, and shelters on the local minimap"></canvas><div id="gps-status">GPS initializing…</div><div class="radar-actions"><button id="radar-zoom-in" title="Zoom minimap in" aria-label="Zoom in">+</button><button id="radar-zoom-out" title="Zoom minimap out" aria-label="Zoom out">−</button><button id="open-map" title="Open city map (M)">MAP <kbd>M</kbd></button></div><div class="radar-legend"><span><i class="legend-dot mission-dot"></i> Mission</span><span><i class="legend-dot shop-dot"></i> Shop</span><span><i class="legend-dot shelter-dot"></i> Cover</span><span><i class="legend-dot police-dot"></i> Police</span></div></aside><div id="map-overlay" hidden role="dialog" aria-label="Full city map"><section class="worldmap-panel"><div class="worldmap-head"><div><h2>NeO 777 // CITY MAP</h2><p id="map-destination">Click a marker to set GPS route</p></div><button id="close-map" aria-label="Close map">✕</button></div><div class="worldmap-body"><canvas id="worldmap" width="760" height="760" aria-label="Click a shop, mission, bridge, or shelter to set a GPS destination"></canvas><div class="map-key"><h3>MAP KEY</h3><p><i class="legend-dot mission-dot"></i> Mission</p><p><i class="legend-dot shop-dot"></i> Shop / garage</p><p><i class="legend-dot shelter-dot"></i> Parking shelter</p><p><i class="legend-dot bridge-dot"></i> Road bridge / skybridge</p><p><i class="legend-dot police-dot"></i> Police patrol / red sight cone</p><p><i class="legend-dot officer-dot"></i> Officer on foot / orange sight cone</p><p><i class="legend-dot helicopter-dot"></i> Helicopter (5 stars)</p><p><i class="legend-dot player-dot"></i> You (arrow)</p><button id="mission-route">Navigate to mission</button><small>Click any marker to route there. Press M or Esc to close.</small></div></div></section></div>`;
const grappleOverlay=document.querySelector<HTMLElement>('#grapple-overlay')!;const grappleFill=document.querySelector<HTMLElement>('#grapple-fill')!;const grappleTime=document.querySelector<HTMLElement>('#grapple-time')!;const arrestOverlay=document.querySelector<HTMLElement>('#arrest-overlay')!;const arrestCaption=document.querySelector<HTMLElement>('#arrest-caption')!;const policeHud=document.querySelector<HTMLElement>('#police-hud')!;const healthHud=document.querySelector<HTMLElement>('#health-hud')!;const vehicleHud=document.querySelector<HTMLElement>('#vehicle-hud')!;const wantedEl=document.querySelector('#wanted')!;const coverEl=document.querySelector<HTMLElement>('#cover-status')!;const stats=document.querySelector('#stats')!, missionEl=document.querySelector('#mission')!,toastEl=document.querySelector('#toast')!;
let toastTimer=0;
function toast(s:string){toastEl.textContent=s;toastTimer=3.5}
const scene=new THREE.Scene();scene.background=new THREE.Color(0x10152c);scene.fog=new THREE.FogExp2(0x10152c,0.006);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,0.1,800);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;app.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xa9bbff,0x372033,2.4));const sun=new THREE.DirectionalLight(0xffb48e,2.5);sun.position.set(65,100,40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-190;sun.shadow.camera.right=190;sun.shadow.camera.top=190;sun.shadow.camera.bottom=-190;scene.add(sun);
const mat=(c:number)=>new THREE.MeshStandardMaterial({color:c,roughness:.8});
const ground= new THREE.Mesh(new THREE.PlaneGeometry(500,500),mat(0x1e4d4d));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
function box(w:number,h:number,d:number,color:number,x:number,y:number,z:number){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o}
const roads=[-120,-60,0,60,120];for(const p of roads){box(500,.08,15,0x303344,0,.07,p);box(15,.08,500,0x303344,p,.08,0);for(let n=-235;n<240;n+=15){box(5,.09,.28,0xffd77b,n,.15,p);box(.28,.09,5,0xffd77b,p,.16,n)}}
const random=(seed:number)=>{let x=Math.sin(seed*127.1+78.23)*43758.5453;return x-Math.floor(x)};
// Ground-plane collision: circular actors against axis-aligned solid footprints.
type Solid = {x:number;z:number;halfX:number;halfZ:number};
const solids:Solid[]=[];
// 3D sight blockers include occupied buildings, elevated skybridges and shelters.
const sightBlockers:THREE.Box3[]=[];
const coverRoofs:{mesh:THREE.Mesh;material:THREE.MeshStandardMaterial}[]=[];
const canals=[-180,180];
const canalHalfWidth=9;
const bridgeHalfLength=8.0;
const onCanalBridge=(z:number,r:number)=>roads.some(road=>Math.abs(z-road)+r<bridgeHalfLength);
const insideWater=(x:number,z:number,r:number)=>canals.some(c=>Math.abs(x-c)<canalHalfWidth+r&&!onCanalBridge(z,r));
function addSightBlocker(cx:number,cy:number,cz:number,sx:number,sy:number,sz:number){
  sightBlockers.push(new THREE.Box3(new THREE.Vector3(cx-sx/2,cy-sy/2,cz-sz/2),new THREE.Vector3(cx+sx/2,cy+sy/2,cz+sz/2)));
}

function addSolid(x:number,z:number,w:number,d:number){solids.push({x,z,halfX:w/2,halfZ:d/2})}
function collides(x:number,z:number,r:number){
  if(x-r < -248 || x+r > 248 || z-r < -248 || z+r > 248 || insideWater(x,z,r))return true;
  for(const b of solids){
    const px=Math.max(b.x-b.halfX,Math.min(x,b.x+b.halfX));
    const pz=Math.max(b.z-b.halfZ,Math.min(z,b.z+b.halfZ));
    if((x-px)**2+(z-pz)**2 < r*r)return true;
  }
  return false;
}
function moveWithCollision(obj:THREE.Object3D,dx:number,dz:number,r:number,others:THREE.Object3D[]=[]){
  const blocked=(x:number,z:number)=>collides(x,z,r)||others.some(o=>o!==obj&&o.visible&&(o.userData.vehicle?vehicleOverlapsCircle(o,x,z,r):Math.hypot(o.position.x-x,o.position.z-z)<r+(o.userData.radius||1)));
  // Substeps prevent tunneling at high speed; axis separation allows sliding along walls.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.6));
  let hit=false;
  for(let i=0;i<steps;i++){
    const sx=dx/steps,sz=dz/steps;
    if(!blocked(obj.position.x+sx,obj.position.z))obj.position.x+=sx;else hit=true;
    if(!blocked(obj.position.x,obj.position.z+sz))obj.position.z+=sz;else hit=true;
  }
  return hit;
}
const buildingColors=[0x43516e,0x615879,0x355b6b,0x705a65,0x466063];
for(let ix=0;ix<8;ix++)for(let iz=0;iz<8;iz++){const x=-210+ix*60,z=-210+iz*60;if(Math.abs(x)<30&&Math.abs(z)<30)continue;
if((x===-150&&z===30)||(x===150&&z===-90)||(x===-90&&z===150)||(x===150&&z===150))continue;const height=12+Math.floor(random(ix*47+iz)*7)*7;box(29,height,29,buildingColors[Math.floor(random(ix*19+iz*4)*5)],x,height/2,z);addSolid(x,z,29,29);addSightBlocker(x,height/2,z,29,height,29);for(let y=5;y<height-2;y+=6)for(const dx of [-10,0,10]){box(3,2,.15,0xffd99a,x+dx,y,z+14.6)}}
// TWO CITY CANALS, TEN BRIDGES: the bridges connect the five east-west streets.
// Water is a forbidden ground-level region except on a bridge deck, so traffic
// and pedestrians are required to cross at actual bridge locations.
const bridgeAccent=[0x4ae6e8,0xfdb863,0xe66dc4,0x83fbc4,0xffd66b];
for(const canalX of canals){
  box(19,.04,495,0x125d85,canalX,.06,0);
  for(let i=0;i<26;i++){
    const zz=-238+i*19;
    box(2,.035,10,i%2?0x227cb1:0x3d9cca,canalX+(i%2?3:-3),.09,zz);
  }
  for(const streetZ of roads){
    const col=bridgeAccent[roads.indexOf(streetZ)];
    box(26,.5,16.0,0x6b768a,canalX,.31,streetZ);
    box(26,.12,13.6,0x384258,canalX,.63,streetZ);
    for(const edge of [-7.7,7.7]){
      box(26,.55,.25,0x8a9ab1,canalX,1.15,streetZ+edge);
      for(let off=-11;off<=11;off+=5.5){
        box(.22,1.4,.24,col,canalX+off,1.35,streetZ+edge);
      }
    }
    for(const side of [-1,1]){
      for(const zz of [-5,5])box(1.2,2,.8,0xf2e9bd,canalX+side*13,1,streetZ+zz);
    }
  }
}

// Six overhead skybridges cross public roads and create helicopter blind spots.
// They are high enough for the player and cars to travel underneath.
function skybridge(x:number,z:number,axis:'x'|'z',tone:number){
  const length=39,width=12,height=10;
  const sx=axis==='x'?length:width, sz=axis==='z'?length:width;
  const deck=box(sx,.75,sz,0x45596e,x,height,z);
  deck.material=mat(0x465975);
  addSightBlocker(x,height,z,sx,.75,sz);
  for(const edge of [-5.45,5.45]){
    if(axis==='x'){
      box(length,1,.22,0x5e93aa,x,height+.83,z+edge);
      box(length,.12,.28,tone,x,height+1.4,z+edge);
    }else{
      box(.22,1,length,0x5e93aa,x+edge,height+.83,z);
      box(.28,.12,length,tone,x+edge,height+1.4,z);
    }
  }
  box(axis==='x'?10:1.5,.4,axis==='z'?10:1.5,0x2f404e,x,height+.65,z);
}
skybridge(30,0,'z',0x56ffef);
skybridge(-30,0,'z',0xfc87c3);
skybridge(90,60,'z',0xffda80);
skybridge(-90,-60,'z',0x5fe9e1);
skybridge(0,-90,'x',0xffa6e1);
skybridge(0,90,'x',0x8cf6a6);

// Open-sided parking shelters with supported roofs and room to drive inside.
// Roofs block helicopter sight, while four narrow corner columns are solid.
const shelterLocations=[[-150,30],[150,-90],[-90,150],[150,150]] as const;
for(let i=0;i<shelterLocations.length;i++){
  const [x,z]=shelterLocations[i];
  const roof=box(28,1,28,0x304c5a,x,7.5,z);
  const roofMat=roof.material as THREE.MeshStandardMaterial;
  roofMat.transparent=true;
  coverRoofs.push({mesh:roof,material:roofMat});
  addSightBlocker(x,7.5,z,28,1,28);
  for(const dx of [-12.6,12.6])for(const dz of [-12.6,12.6]){
    box(.9,7,.9,0x526c82,x+dx,3.5,z+dz);
    addSolid(x+dx,z+dz,.9,.9);
  }
  box(25,.09,.6,0x57f4dc,x,.13,z-12.9);
  box(25,.09,.6,0x57f4dc,x,.13,z+12.9);
  const sign=box(8,.85,.5,0x41cfc0,x,6.5,z-14.15);
  sign.material=mat(0x41cfc0);
}

// A helicopter ray is blocked by buildings, skybridges and parking roofs.
const sightRay=new THREE.Ray();
function helicopterHasSight(aircraft:THREE.Vector3,person:THREE.Vector3){
  const direction=person.clone().add(new THREE.Vector3(0,1.5,0)).sub(aircraft);
  const distance=direction.length();
  sightRay.set(aircraft,direction.normalize());
  const hit=new THREE.Vector3();
  return !sightBlockers.some(blocker=>sightRay.intersectBox(blocker,hit)!==null && hit.distanceTo(aircraft)<distance-.4);
}

function marker(x:number,z:number,color:number){const group=new THREE.Group();const cyl=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,.15,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6}));cyl.position.y=.3;group.add(cyl);const cone=new THREE.Mesh(new THREE.ConeGeometry(1.3,3,6),new THREE.MeshBasicMaterial({color}));cone.rotation.z=Math.PI;cone.position.y=4;group.add(cone);group.position.set(x,0,z);scene.add(group);return group}
const player=createHuman(0x26d9df,2);scene.add(player);player.position.set(0,0,8);
const npcs:Human[]=[];
function spawnPedestrian(i:number){
  const p=createHuman(SHIRT_COLORS[i%SHIRT_COLORS.length],i);
  // Stay out of buildings, road vehicles, player and other pedestrians.
  for(let attempt=0;attempt<180;attempt++){
    const x=(random(i*43+attempt*11+50)-.5)*440;
    const z=(random(i*19+attempt*7+100)-.5)*440;
    if(!collides(x,z,1.2)&&Math.hypot(x-player.position.x,z-player.position.z)>16&&
      !npcs.some(other=>Math.hypot(x-other.position.x,z-other.position.z)<3)){
      p.position.set(x,0,z);break;
    }
  }
  p.rotation.y=random(i+130)*Math.PI*2;
  scene.add(p);npcs.push(p);
}
for(let i=0;i<32;i++)spawnPedestrian(i);
let pedestrianId=32;
let respawnQueue:number[]=[];
const ragdolls:Ragdoll[]=[];
type MoneyDrop={group:THREE.Group;cash:number;age:number;initialY:number};
const moneyDrops:MoneyDrop[]=[];
const greenBill=mat(0x76ff9c),darkBill=mat(0x217b48);
function dropCash(position:THREE.Vector3, amount:number){
  const bundle=new THREE.Group();
  for(let i=0;i<3;i++){
    const bill=new THREE.Mesh(new THREE.BoxGeometry(1.05,.10,.55),i===1?darkBill:greenBill);
    bill.position.y=.17+i*.11;bundle.add(bill);
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.95,.085,6,18),new THREE.MeshBasicMaterial({color:0x8cffa6}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.09;bundle.add(ring);
  bundle.position.set(position.x,.1,position.z);scene.add(bundle);
  moneyDrops.push({group:bundle,cash:amount,age:0,initialY:.1});
}
function knockDownPedestrian(p:Human, impact:THREE.Vector3, speed:number){
  const idx=npcs.indexOf(p);if(idx<0)return;
  npcs.splice(idx,1);scene.remove(p);
  const doll=new Ragdoll(scene,p.position.clone(),p.rotation.y,p.userData.shirtColor,p.userData.skinColor,p.userData.pantsColor,impact,speed);
  ragdolls.push(doll);
  const amount=20+Math.floor(Math.random()*61);
  dropCash(p.position,amount);
  setWanted(Math.min(5,wanted+1));
  respawnQueue.push(performance.now()/1000+38);
  toast(`Pedestrian hit! Cash dropped: $${amount} · Wanted ${wanted}/5`);
}
function sweepPedestrians(from:THREE.Vector3,delta:THREE.Vector3,speed:number){
  if(Math.abs(speed)<4)return;
  const distSq=delta.x*delta.x+delta.z*delta.z;
  if(distSq<.00001)return;
  for(const p of [...npcs]){
    const dx=p.position.x-from.x,dz=p.position.z-from.z;
    const t=THREE.MathUtils.clamp((dx*delta.x+dz*delta.z)/distSq,0,1);
    const hitX=from.x+delta.x*t,hitZ=from.z+delta.z*t;
    if(Math.hypot(hitX-p.position.x,hitZ-p.position.z)<2.7){
      knockDownPedestrian(p,delta.clone().normalize(),Math.abs(speed));
    }
  }
}

function car(color:number,x:number,z:number,isPolice=false){const g=createVehicle(color,isPolice);g.position.set(x,0,z);scene.add(g);return g}
const cars=[car(0xff538b,9,8),car(0x56b3ff,64,10),car(0xffc15e,-65,-10),car(0x9b7bff,10,66),car(0x73e0aa,-10,-66)];let activeCar:THREE.Group|null=null;let velocity=0,wanted=0,cooldown=0,health=100,arrestProgress=0,detected=false,damageFlash=0;let smoothedSteer=0;
const shops=[{x:67,z:67,name:'Garage',cost:150},{x:-65,z:67,name:'Streetwear',cost:75}];shops.forEach(s=>marker(s.x,s.z,0x42edb8));
const missions=[{title:'Courier Run',x:115,z:-60,reward:125,desc:'Deliver a sealed package across town.'},{title:'Midnight Circuit',x:-120,z:115,reward:200,desc:'Reach the underground race meetup.'},{title:'The Exchange',x:120,z:120,reward:300,desc:'Complete a risky handoff.'},{title:'City Legend',x:-120,z:-120,reward:450,desc:'Make your name known across the city.'}];
let missionActive=false;const missionMarkers=missions.map((m,i)=>marker(m.x,m.z,i===0?0xffe168:0x78808b));const startMarker=marker(-7,-7,0xffe168);
const keys=new Set<string>();
const clearKeys=()=>keys.clear();
window.addEventListener('blur',clearKeys);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearKeys()});
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  // UI keys never become gameplay input; closing a map requires a fresh movement press.
  if(key==='m'||key==='escape'){clearKeys();return}
  if(key==='f'&&grapple){
    e.preventDefault();
    if(!e.repeat){grapple.resistance++;grappleFill.style.width=`${Math.min(100,grapple.resistance/7*100)}%`}
    return;
  }
  if(arrestSequence||grapple||mapUI.isOpen()){clearKeys();return}
  if(e.repeat)return;
  keys.add(key);
  // Development-only shortcuts to verify helicopter behavior without harming NPCs.
  if(import.meta.env.DEV&&key==='5'){setWanted(5);toast('DEV: Five-star response triggered')}
  if(import.meta.env.DEV&&key==='0'){setWanted(0);toast('DEV: Wanted level cleared')}
  if(key==='e')interact();
  if(key==='r')resetPlayerPosition();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
// A mouse click can open the map without a key event while acceleration is held.
document.querySelector('#open-map')!.addEventListener('click',clearKeys);
let storageWarningShown=false;
function persist(){
  const serialized=JSON.stringify(save);
  let stored=false;
  for(const key of ['neon-save','neo777-save']){
    try{localStorage.setItem(key,serialized);stored=true}catch{/* Gameplay remains usable with session-only progress. */}
  }
  if(!stored&&!storageWarningShown){storageWarningShown=true;toast('Browser storage unavailable — progress lasts for this session')}
}
function vehicleExitLocations(car:THREE.Group){
  return [new THREE.Vector3(4,0,-.35),new THREE.Vector3(-4,0,-.35),new THREE.Vector3(0,0,-6),new THREE.Vector3(0,0,6)]
    .map(offset=>offset.applyAxisAngle(new THREE.Vector3(0,1,0),car.rotation.y).add(car.position));
}
function interact(){
  if(arrestSequence||grapple||mapUI.isOpen())return;
  const pos=activeCar?.position||player.position;
  if(!activeCar&&wanted>0&&units.some(u=>u.officer&&u.officer.position.distanceTo(player.position)<3&&policeCanSee(u.officer,player.position,34))){arrestPlayer('You surrendered');return}
  if(activeCar){
    const car=activeCar;
    const spot=vehicleExitLocations(car).find(position=>isExitClear(position));
    if(!spot){toast('Cannot exit: no clear space');return}
    player.position.copy(spot);player.visible=true;activeCar=null;velocity=0;clearKeys();toast('Exited vehicle');return;
  }
  const near=cars.find(c=>c.position.distanceTo(pos)<7);
  if(near){activeCar=near;player.visible=false;const motion=carMotion.get(near)!;velocity=forwardSpeed(near,motion);toast('Vehicle entered — no wanted level');return}
  for(const shop of shops)if(Math.hypot(shop.x-pos.x,shop.z-pos.z)<9){
    if(save.cash<shop.cost){toast(`Need $${shop.cost} for ${shop.name}`);return}
    save.cash-=shop.cost;save.upgrades++;
    if(shop.name==='Garage'){
      const nearbyCar=cars.slice().sort((a,b)=>a.position.distanceToSquared(pos)-b.position.distanceToSquared(pos))[0];
      if(nearbyCar&&nearbyCar.position.distanceTo(pos)<16){repairVehicle(nearbyCar);toast('Garage: Car repaired, panels restored!')}
      else toast('Garage upgrade purchased!');
    }else toast(`${shop.name}: upgrade purchased!`);
    persist();return;
  }
  if(Math.hypot(pos.x+7,pos.z+7)<9&&!missionActive){missionActive=true;toast(`Mission started: ${missions[save.completed%missions.length].title}`);return}
  toast('Move near a vehicle, shop, or mission marker to interact');
}
const police=[car(0x202b54,-10,30,true),car(0x202b54,30,-10,true),car(0x182743,-35,25,true),car(0x182743,35,-35,true),car(0x131e36,-55,0,true),car(0x131e36,0,-55,true)];
police.forEach((c,i)=>{const lamp=new THREE.PointLight(i%2?0x358dff:0xff285c,3,12);lamp.position.y=3.5;c.add(lamp)});
// Shared capsule bodies: player cars, stationary cars and patrols all use the same solver.
const carMotion=new Map<THREE.Group,VehicleMotion>();
const allVehicles=[...cars,...police];
allVehicles.forEach(car=>{car.userData.vehicle=true;carMotion.set(car,createVehicleMotion(police.includes(car)))});
function vehicleSpeed(car:THREE.Group){return motionSpeed(carMotion.get(car)!)}
function resetVehicleMotion(car:THREE.Group){resetMotion(carMotion.get(car)!)}
function isExitClear(position:THREE.Vector3,ignoreOfficer:Human|null=null){
  return !collides(position.x,position.z,.85)
    &&allVehicles.every(car=>!vehicleOverlapsCircle(car,position.x,position.z,.95))
    &&units.every(unit=>!unit.officer||unit.officer===ignoreOfficer||Math.hypot(unit.officer.position.x-position.x,unit.officer.position.z-position.z)>1.7);
}
function freePlayerSpawn(){
  const candidates=[new THREE.Vector3(0,0,8)];
  for(let radius=3;radius<=48;radius+=3)for(let i=0;i<16;i++)candidates.push(new THREE.Vector3(Math.sin(i*Math.PI/8)*radius,0,8+Math.cos(i*Math.PI/8)*radius));
  return candidates.find(position=>isExitClear(position));
}
function resetPlayerPosition(){
  clearKeys();velocity=0;smoothedSteer=0;
  if(activeCar){
    const car=activeCar,previous=car.position.clone();
    const available=()=>!vehicleWorldBlocked(car,car.position.x,car.position.z,car.rotation.y,collides)&&allVehicles.every(other=>other===car||!vehiclesOverlap(car,other));
    car.position.set(9,0,8);
    if(!available()){
      let found=false;
      for(let radius=2;radius<=48&&!found;radius+=2)for(let i=0;i<16;i++){
        car.position.set(9+Math.sin(i*Math.PI/8)*radius,0,8+Math.cos(i*Math.PI/8)*radius);
        if(available()){found=true;break}
      }
      if(!found)car.position.copy(previous);
    }
    resetVehicleMotion(car);
  }else{
    const spawn=freePlayerSpawn();if(spawn)player.position.copy(spawn);
  }
}
// Some legacy patrol coordinates were inside buildings. Move only invalid spawns.
const placedVehicles:THREE.Group[]=[];
for(const car of allVehicles){
  const origin=car.position.clone();
  const clear=()=>!vehicleWorldBlocked(car,car.position.x,car.position.z,car.rotation.y,collides)&&placedVehicles.every(other=>!vehiclesOverlap(car,other));
  if(!clear()){
    let placed=false;
    for(let radius=2;radius<=60&&!placed;radius+=2)for(let i=0;i<16;i++){
      car.position.set(origin.x+Math.sin(i*Math.PI/8)*radius,0,origin.z+Math.cos(i*Math.PI/8)*radius);
      if(clear()){placed=true;break}
    }
    if(!placed)car.position.copy(origin);
  }
  placedVehicles.push(car);
}
let impactToastCooldown=0;
function handleVehicleImpact(impact:VehicleImpact<THREE.Group>){
  const contact=new THREE.Vector3(impact.x,1.4,impact.z);
  dentVehicle(impact.a,contact,impact.speed);
  if(impact.b)dentVehicle(impact.b,contact,impact.speed);
  if((impact.a===activeCar||impact.b===activeCar)&&impactToastCooldown<=0){
    toast(impact.b?'Vehicle collision — momentum transferred!':'Hit an obstacle!');impactToastCooldown=.65;
  }
}
function simulateVehicles(dt:number){
  impactToastCooldown=Math.max(0,impactToastCooldown-dt);
  stepVehiclePhysics(allVehicles,carMotion,dt,(x,z,r)=>collides(x,z,r)||(player.visible&&Math.hypot(x-player.position.x,z-player.position.z)<r+.78),handleVehicleImpact);
}
const policeByWanted=[0,1,2,3,4,6];
type PoliceUnit={car:THREE.Group;officer:Human|null;lastKnown:THREE.Vector3;memory:number;shotCooldown:number;obstacleTurn:number;detourTime:number;detourX:number;detourZ:number;unitSees:boolean;pullProgress:number;officerModel:Human|null;recovery:number};
const units:PoliceUnit[]=police.map(c=>({car:c,officer:null,lastKnown:c.position.clone(),memory:0,shotCooldown:1,obstacleTurn:1,detourTime:0,detourX:0,detourZ:0,unitSees:false,pullProgress:0,officerModel:null,recovery:0}));
let arrestOfficer:Human|null=null;
const copRay=new THREE.Ray();const copHit=new THREE.Vector3();
function groundHasSight(observer:THREE.Vector3,subject:THREE.Vector3){
  const from=observer.clone().add(new THREE.Vector3(0,observer.y>1?0:2.4,0));
  const end=subject.clone().add(new THREE.Vector3(0,subject.y>1?0:1.6,0));
  const d=end.sub(from),distance=d.length();if(distance<.01)return true;
  copRay.set(from,d.normalize());
  return !sightBlockers.some(b=>copRay.intersectBox(b,copHit)!==null&&copHit.distanceTo(from)<distance-.25);
}
function policeCanSee(observer:THREE.Object3D,target:THREE.Vector3,range:number){
  return inPoliceVisionCone({x:observer.position.x,z:observer.position.z,heading:observer.rotation.y},{x:target.x,z:target.z},range)
    &&groundHasSight(observer.position,target);
}
function setWanted(level:number){
  const previous=wanted;
  wanted=THREE.MathUtils.clamp(Math.round(level),0,5);
  cooldown=wanted?10+wanted*4:0;
  detected=false;arrestProgress=0;arrestOfficer=null;
  if(wanted>previous){
    // Dispatch to the reported incident, not to a magical live player coordinate.
    const reported=(activeCar||player).position;
    units.slice(0,policeByWanted[wanted]).forEach(u=>{
      u.lastKnown.copy(reported);u.memory=Math.max(u.memory,12);
      u.detourTime=0;
    });
  }
  if(!wanted)units.forEach(u=>{if(u.officer){scene.remove(u.officer);u.officer=null;}u.memory=0;u.unitSees=false;u.pullProgress=0;u.detourTime=0;});
}
type Grapple={officer:Human;elapsed:number;resistance:number;lastStrike:number};
let grapple:Grapple|null=null;
let struggleImmunity=0;
let arrestSequence=0;
let arrestFine=0;
let arrestReason='';
function resetGrapple(){
  if(grapple){grapple.officer.userData.leftArm.rotation.x=0;grapple.officer.userData.rightArm.rotation.x=0}
  player.userData.leftArm.rotation.x=0;player.userData.rightArm.rotation.x=0;
  grappleOverlay.hidden=true;grapple=null;grappleFill.style.width='0%';grappleTime.textContent='';
  arrestOfficer=null;arrestProgress=0;clearKeys();
  units.forEach(unit=>unit.pullProgress=0);
}
function closeGameplayMap(){
  document.querySelector<HTMLElement>('#map-overlay')!.hidden=true;
  document.body.classList.remove('map-is-open');
}
function beginGrapple(officer:Human){
  if(grapple||arrestSequence||struggleImmunity>0||!wanted||officer.position.distanceTo(player.position)>3||!groundHasSight(officer.position,player.position))return;
  clearKeys();closeGameplayMap();arrestOfficer=null;arrestProgress=0;
  grapple={officer,elapsed:0,resistance:0,lastStrike:0};
  grappleOverlay.hidden=false;grappleFill.style.width='0%';grappleTime.textContent='3.8s — 0/7 escape presses';
  toast('POLICE GRAPPLE — Mash F to break away!');
}
function pullDriverFromCar(officer:Human){
  if(!activeCar||grapple||arrestSequence||struggleImmunity>0||vehicleSpeed(activeCar)>2.5||!groundHasSight(officer.position,activeCar.position))return false;
  const grabbed=activeCar;
  // Extraction starts at a nearby reachable door, avoiding walls and every vehicle.
  const exit=vehicleExitLocations(grabbed)
    .sort((a,b)=>a.distanceToSquared(officer.position)-b.distanceToSquared(officer.position))
    .find(position=>position.distanceTo(officer.position)<2.8&&isExitClear(position,officer)&&groundHasSight(officer.position,position));
  if(!exit)return false;
  player.position.copy(exit);player.visible=true;activeCar=null;velocity=0;resetVehicleMotion(grabbed);
  beginGrapple(officer);
  return true;
}
function updateGrapple(dt:number){
  if(!grapple)return;
  const officer=grapple.officer;
  if(!wanted||!units.some(unit=>unit.officer===officer)||officer.position.distanceTo(player.position)>4||!groundHasSight(officer.position,player.position)){
    resetGrapple();struggleImmunity=1.5;return;
  }
  grapple.elapsed+=dt;
  // A readable, stylized melee exchange with alternating arm movements.
  const phase=grapple.elapsed*10;
  officer.userData.leftArm.rotation.x=-.5+Math.sin(phase)*1.15;
  officer.userData.rightArm.rotation.x=-.5+Math.sin(phase+Math.PI)*1.15;
  player.userData.leftArm.rotation.x=-.45+Math.sin(phase+1)*.75;
  player.userData.rightArm.rotation.x=-.45+Math.sin(phase+3)*.75;
  player.rotation.y=Math.atan2(officer.position.x-player.position.x,officer.position.z-player.position.z);
  officer.rotation.y=Math.atan2(player.position.x-officer.position.x,player.position.z-officer.position.z);
  const push=Math.max(0,2.1-Math.hypot(officer.position.x-player.position.x,officer.position.z-player.position.z));
  if(push>0){const away=player.position.clone().sub(officer.position).setY(0).normalize();moveWithCollision(player,away.x*push*dt*3,away.z*push*dt*3,.85,allVehicles)}
  if(grapple.elapsed-grapple.lastStrike>.8){grapple.lastStrike=grapple.elapsed;health=Math.max(1,health-5);damageFlash=.28}
  grappleTime.textContent=`${Math.max(0,3.8-grapple.elapsed).toFixed(1)}s — ${Math.min(7,grapple.resistance)}/7 escape presses`;
  if(grapple.resistance>=7){resetGrapple();struggleImmunity=5;toast('BROKE FREE — Run!');return}
  if(grapple.elapsed>=3.8)arrestPlayer('Arrested after a struggle');
}
function arrestPlayer(reason:string){
  if(arrestSequence>0)return;
  resetGrapple();closeGameplayMap();
  arrestFine=Math.min(save.cash,75+wanted*40);
  arrestReason=reason;
  arrestCaption.textContent=`${reason.toUpperCase()} · FINE $${arrestFine}`;
  arrestSequence=4.1;arrestOverlay.hidden=false;
  // Replaying the CSS animation from its first frame on each arrest.
  arrestOverlay.classList.remove('show');void arrestOverlay.offsetWidth;arrestOverlay.classList.add('show');
}
function finishArrest(){
  save.cash=Math.max(0,save.cash-arrestFine);persist();setWanted(0);health=100;velocity=0;smoothedSteer=0;
  allVehicles.forEach(resetVehicleMotion);
  activeCar=null;player.visible=true;player.rotation.set(0,0,0);
  // A patrol or a pushed car can occupy the original spawn; pick a nearby free release point.
  const release=freePlayerSpawn();
  if(release)player.position.copy(release);
  resetGrapple();arrestOverlay.hidden=true;arrestOverlay.classList.remove('show');arrestSequence=0;
  struggleImmunity=4;toast(`${arrestReason} — released at city center, $${arrestFine} fine`);
}
function makeOfficer(u:PoliceUnit){
  if(u.recovery>0||u.officer||vehicleSpeed(u.car)>2)return;
  const spawn=vehicleExitLocations(u.car).find(position=>isExitClear(position)
    &&(!player.visible||position.distanceTo(player.position)>1.7)
    &&npcs.every(npc=>position.distanceTo(npc.position)>1.7)
    &&units.every(unit=>!unit.officer||position.distanceTo(unit.officer.position)>1.7));
  if(!spawn)return;
  let npc=u.officerModel;
  if(!npc){
    npc=createHuman(0x1b4673,18+units.indexOf(u));
    // Keep one reusable officer model per patrol, including its original cap/badge.
    const hat=new THREE.Mesh(new THREE.CylinderGeometry(.38,.43,.17,12),mat(0x0c263d));hat.position.set(0,3.51,0);npc.add(hat);
    const badge=new THREE.Mesh(new THREE.BoxGeometry(.12,.16,.035),mat(0xf8ce5c));badge.position.set(.25,2.36,.29);npc.add(badge);
    u.officerModel=npc;
  }
  npc.position.copy(spawn);const facing=(activeCar||player).position.clone().sub(spawn);npc.rotation.y=Math.atan2(facing.x,facing.z);
  animateHuman(npc,0,0);npc.visible=true;scene.add(npc);u.officer=npc;
  u.shotCooldown=Math.max(u.shotCooldown,1);u.pullProgress=0;
  toast('Police officers have exited their patrol car!');
}
const OFFICER_RECOVERY_SECONDS=6.5;
function hitOfficerWithCar(unit:PoliceUnit,direction:THREE.Vector3,speed:number){
  const officer=unit.officer;
  if(!officer||unit.recovery>0)return;
  const doll=new Ragdoll(scene,officer.position.clone(),officer.rotation.y,officer.userData.shirtColor,officer.userData.skinColor,officer.userData.pantsColor,direction,speed,OFFICER_RECOVERY_SECONDS);
  ragdolls.push(doll);scene.remove(officer);unit.officer=null;unit.officerModel=officer;
  unit.recovery=OFFICER_RECOVERY_SECONDS;unit.pullProgress=0;unit.unitSees=false;
  if(grapple?.officer===officer)resetGrapple();
  if(arrestOfficer===officer){arrestOfficer=null;arrestProgress=0}
  setWanted(Math.min(5,wanted+1));
  // Refresh the reported incident even at the five-star cap.
  const reported=(activeCar||player).position;
  units.slice(0,policeByWanted[wanted]).forEach(u=>{u.lastKnown.copy(reported);u.memory=Math.max(u.memory,12)});
  toast(`Officer hit by vehicle! Wanted ${wanted}/5`);
}
function sweepOfficers(from:VehicleHitPose,to:VehicleHitPose,speed:number){
  if(!activeCar||speed<4||arrestSequence)return;
  const direction=new THREE.Vector3(to.x-from.x,0,to.z-from.z);
  if(direction.lengthSq()<.000001){const m=carMotion.get(activeCar)!;direction.set(m.vx,0,m.vz)}
  if(direction.lengthSq()<.000001)return;
  direction.normalize();
  const start=new THREE.Vector3(from.x,0,from.z);
  const end=new THREE.Vector3(to.x,0,to.z);
  for(const unit of units){
    const officer=unit.officer;
    if(!officer||unit.recovery>0)continue;
    // Use the integrated motion and world visibility; a wall stops strikes behind it.
    if((groundHasSight(start,officer.position)||groundHasSight(end,officer.position))
      &&sweptVehicleHit(from,to,{x:officer.position.x,z:officer.position.z},VEHICLE_RADIUS,VEHICLE_HALF_SEGMENT,officer.userData.radius)){
      hitOfficerWithCar(unit,direction,speed);
    }
  }
}
type ShotEffect={line:THREE.Line;ttl:number};const shots:ShotEffect[]=[];
function policeShoot(origin:THREE.Vector3,target:THREE.Vector3){
  const muzzle=origin.clone().add(new THREE.Vector3(0,2.2,0));
  const impact=target.clone().add(new THREE.Vector3(0,1.5,0));
  const geo=new THREE.BufferGeometry().setFromPoints([muzzle,impact]);
  const matLine=new THREE.LineBasicMaterial({color:0xffdc75,transparent:true,opacity:1});
  const line=new THREE.Line(geo,matLine);scene.add(line);shots.push({line,ttl:.17});
  health=Math.max(0,health-(activeCar?4:7));damageFlash=.22;
  if(health<=0){arrestPlayer('Injured during pursuit');}
}
function updatePolice(dt:number,target:THREE.Object3D){
  const count=wanted?policeByWanted[wanted]:0;
  let anyGroundSight=false,nearestOfficer=Infinity;
  let closeOfficer:Human|null=null;
  for(let i=0;i<units.length;i++){
    const u=units[i],car=u.car;
    u.recovery=Math.max(0,u.recovery-dt);
    if(i>=count){
      u.unitSees=false;u.memory=0;u.pullProgress=0;
      if(u.officer){scene.remove(u.officer);u.officer=null;}
      continue;
    }
    if(u.recovery>0){u.unitSees=false;u.pullProgress=0;u.memory=Math.max(0,u.memory-dt);driveToward(car,carMotion.get(car)!,0,0,0,dt);continue}
    const carDist=Math.hypot(car.position.x-target.position.x,car.position.z-target.position.z);
    const footDist=u.officer?Math.hypot(u.officer.position.x-target.position.x,u.officer.position.z-target.position.z):Infinity;
    const carSight=carDist<47&&policeCanSee(car,target.position,47);
    const footSight=!!u.officer&&footDist<34&&policeCanSee(u.officer,target.position,34);
    u.unitSees=carSight||footSight;
    if(u.unitSees){
      anyGroundSight=true;u.lastKnown.copy(target.position);u.memory=7.5;
    }else u.memory=Math.max(0,u.memory-dt);
    // Patrols head toward the last confirmed position, never the player's
    // current position while hidden or beyond line-of-sight range.
    if(u.memory>0){
      const goal=u.lastKnown.clone().sub(car.position);goal.y=0;
      const distance=goal.length();
      if(!u.officer&&distance>20){
        const direction=goal.normalize();
        const slow=Math.max(0,Math.min(13,(distance-12)*1.7));
        const motion=carMotion.get(car)!;
        // A blocked patrol steers around the obstruction using the same momentum model.
        u.detourTime=Math.max(0,u.detourTime-dt);
        if(motion.hitWall&&u.detourTime<=0){
          const side=u.obstacleTurn;
          u.detourX=direction.z*side;u.detourZ=-direction.x*side;
          u.detourTime=2.3;
          u.obstacleTurn*=-1;
        }
        if(u.detourTime>0)direction.set(u.detourX,0,u.detourZ);
        driveToward(car,motion,direction.x,direction.z,slow,dt);
      }
      if(!u.officer&&distance<=20){driveToward(car,carMotion.get(car)!,0,0,0,dt);if(carSight&&vehicleSpeed(car)<2)makeOfficer(u)}
    }
    if(u.officer){
      const officer=u.officer;
      const goal=(footSight?target.position:u.lastKnown).clone().sub(officer.position);goal.y=0;
      const dist=goal.length();
      if(u.memory>0&&dist>2){
        goal.normalize();officer.rotation.y=Math.atan2(goal.x,goal.z);
        const blocked=moveWithCollision(officer,goal.x*dt*(wanted>=3?5.6:4.2),goal.z*dt*(wanted>=3?5.6:4.2),.8,[...cars,...police,...npcs,player,...units.flatMap(v=>v.officer?[v.officer]:[])]);
        animateHuman(officer,dt,blocked?0:1);
      }else animateHuman(officer,dt,0);
      const actualDistance=officer.position.distanceTo(target.position);
      const seesNow=actualDistance<34&&policeCanSee(officer,target.position,34);
      nearestOfficer=Math.min(nearestOfficer,actualDistance);
      if(!activeCar&&seesNow&&actualDistance<2.5&&(officer===arrestOfficer||!closeOfficer))closeOfficer=officer;
      u.shotCooldown-=dt;
      // Officers drag drivers out of a stopped / slow car, then grapple before arrest.
      if(activeCar&&seesNow&&actualDistance<4.8&&vehicleSpeed(activeCar)<=2.5&&struggleImmunity<=0){
        u.pullProgress+=dt;
        if(u.pullProgress>=1.25&&pullDriverFromCar(officer)){
          u.pullProgress=0;
          toast('OFFICER PULLED YOU OUT — Press F to resist!');
          return {anyGroundSight:true,nearestOfficer:dist};
        }
      }else u.pullProgress=0;
      // Higher-threat pursuit: readable tracer, limited fire rate, solid line of sight.
      if(wanted>=3&&footSight&&dist<26&&dist>3.1&&u.shotCooldown<=0){
        u.shotCooldown=2.4+i*.18;
        policeShoot(officer.position,target.position);
        if(wanted===0)return {anyGroundSight:false,nearestOfficer:Infinity};
      }
      // Officers abandon a stale search instead of tracking you through walls.
      if(u.memory<=0){
        const toCar=u.car.position.clone().sub(officer.position);toCar.y=0;
        if(toCar.length()<4){scene.remove(officer);u.officer=null;}
        else{toCar.normalize();moveWithCollision(officer,toCar.x*dt*4,toCar.z*dt*4,.8,[...cars,...police,...npcs,player]);officer.rotation.y=Math.atan2(toCar.x,toCar.z);animateHuman(officer,dt,1);}
      }
    }
  }
  if(!activeCar&&wanted>0&&closeOfficer&&struggleImmunity<=0){
    if(arrestOfficer!==closeOfficer){arrestOfficer=closeOfficer;arrestProgress=0}
    arrestProgress=Math.min(1.25,arrestProgress+dt);
    if(arrestProgress>=1.25){beginGrapple(closeOfficer);arrestProgress=0}
  }else{arrestProgress=0;arrestOfficer=null}
  return {anyGroundSight,nearestOfficer};
}
// Helicopter is a visible 5-star-only unit. It maintains a last known player
// position and searches for the player when structures obstruct line of sight.
function createPoliceHelicopter(){
  const g=new THREE.Group();
  const navy=mat(0x182942),detail=mat(0x94b2c5),glass=mat(0x3b90a5);
  const body=new THREE.Mesh(new THREE.SphereGeometry(3.4,12,10),navy);
  body.scale.set(1.35,.56,.65);g.add(body);
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(1.7,12,8),glass);
  cockpit.scale.set(.95,.65,.85);cockpit.position.set(0,.1,2.15);g.add(cockpit);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(.48,.45,7.7),navy);
  tail.position.set(0,.25,-5);g.add(tail);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.2,1.9,2),navy);
  fin.position.set(0,1,-8.5);g.add(fin);
  const rotors=new THREE.Group();rotors.position.y=1.9;
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,1.4,8),detail);
  mast.position.y=-.65;rotors.add(mast);
  for(let i=0;i<4;i++){
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.28,.1,16),detail);
    blade.rotation.y=i*Math.PI/4;rotors.add(blade);
  }
  g.add(rotors);
  const tailRotor=new THREE.Group();tailRotor.position.set(.22,1,-8.5);
  for(let i=0;i<2;i++){
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.09,.22,3),detail);
    blade.rotation.x=i*Math.PI/2;tailRotor.add(blade);
  }
  g.add(tailRotor);
  for(const side of [-1,1]){
    const skid=new THREE.Mesh(new THREE.BoxGeometry(.18,.15,5),detail);
    skid.position.set(side*2,-1.7,.2);g.add(skid);
    for(const z of [-1.5,1.5]){
      const strut=new THREE.Mesh(new THREE.BoxGeometry(.16,1.2,.16),detail);
      strut.position.set(side*2,-1.05,z);g.add(strut);
    }
  }
  const lamp=new THREE.SpotLight(0xfff6b5,35,90,Math.PI/8,.45,1.4);
  lamp.position.set(0,-1,1.7);g.add(lamp);
  const aim=new THREE.Object3D();scene.add(aim);lamp.target=aim;
  const beamMat=new THREE.MeshBasicMaterial({color:0xfff5ae,transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.25,7,1,20,1,true),beamMat);
  scene.add(beam);
  const pool=new THREE.Mesh(new THREE.CircleGeometry(7,24),new THREE.MeshBasicMaterial({color:0xfff6a6,transparent:true,opacity:.18,depthWrite:false}));
  pool.rotation.x=-Math.PI/2;pool.position.y=.17;scene.add(pool);
  g.visible=false;beam.visible=false;pool.visible=false;lamp.visible=false;
  scene.add(g);
  return {g,rotors,tailRotor,beam,pool,lamp,aim};
}
const helicopter=createPoliceHelicopter();
let helicopterVisible=false,helicopterSeesPlayer=false,helicopterLastKnown=new THREE.Vector3(),helicopterSearchTime=0;
function updateHelicopter(dt:number,now:number,playerTarget:THREE.Object3D){
  if(wanted!==5){
    if(helicopterVisible)toast('Police helicopter leaving the area');
    helicopterVisible=false;helicopterSeesPlayer=false;
    helicopter.g.visible=false;helicopter.beam.visible=false;helicopter.pool.visible=false;helicopter.lamp.visible=false;
    return;
  }
  if(!helicopterVisible){
    helicopterVisible=true;helicopterSearchTime=0;
    helicopterLastKnown.copy(playerTarget.position);
    helicopter.g.position.copy(playerTarget.position).add(new THREE.Vector3(-68,70,-62));
    toast('FIVE STARS — Police helicopter incoming! Hide under cover.');
  }
  helicopter.g.visible=true;helicopter.beam.visible=true;helicopter.pool.visible=true;helicopter.lamp.visible=true;
  // Detect only within practical range and without solid roofs in the beam's path.
  helicopterSeesPlayer=helicopter.g.position.distanceTo(playerTarget.position)<110 &&
    helicopterHasSight(helicopter.g.position,playerTarget.position);
  if(helicopterSeesPlayer){
    helicopterLastKnown.copy(playerTarget.position);
    helicopterSearchTime=0;
  }else helicopterSearchTime+=dt;
  const tracking=helicopterSeesPlayer?playerTarget.position:helicopterLastKnown;
  const circle=helicopterSearchTime>0?new THREE.Vector3(Math.sin(now*.0005)*16,0,Math.cos(now*.0005)*16):new THREE.Vector3();
  const desired=tracking.clone().add(new THREE.Vector3(26+circle.x,69+Math.sin(now*.001)*2,20+circle.z));
  helicopter.g.position.lerp(desired,Math.min(1,dt*.65));
  const diff=tracking.clone().sub(helicopter.g.position);
  helicopter.g.rotation.y=THREE.MathUtils.lerp(helicopter.g.rotation.y,Math.atan2(diff.x,diff.z),Math.min(1,dt*2));
  helicopter.rotors.rotation.y+=dt*27;
  helicopter.tailRotor.rotation.x+=dt*37;
  const spot=tracking.clone().add(circle.clone().multiplyScalar(.4));
  helicopter.aim.position.copy(spot).add(new THREE.Vector3(0,.25,0));
  helicopter.pool.position.set(spot.x,.18,spot.z);
  helicopter.g.updateMatrixWorld(true);
  const beamOrigin=helicopter.g.localToWorld(new THREE.Vector3(0,-1,1.7));
  const beamEnd=spot.clone();beamEnd.y=.2;
  const beamDirection=beamEnd.clone().sub(beamOrigin);
  helicopter.beam.scale.set(1,beamDirection.length(),1);
  helicopter.beam.position.copy(beamOrigin).add(beamEnd).multiplyScalar(.5);
  helicopter.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),beamDirection.normalize());
  helicopter.pool.visible=helicopterSeesPlayer;
  helicopter.lamp.intensity=helicopterSeesPlayer?35:15;
  (helicopter.beam.material as THREE.MeshBasicMaterial).opacity=helicopterSeesPlayer ? .13 : .045;
}

// The navigable minimap mirrors real roads, waterways, buildings, bridges,
// shops, missions, aerial cover and dynamically pursuing police units.
const mapPoints:MapPoint[]=[
 ...missions.map(m=>({x:m.x,z:m.z,label:m.title,kind:'mission' as const})),
 ...shops.map(s=>({x:s.x,z:s.z,label:s.name,kind:'shop' as const})),
 ...shelterLocations.map(([x,z],i)=>({x,z,label:`Parking shelter ${i+1}`,kind:'shelter' as const})),
 ...canals.flatMap((x,i)=>roads.map((z,j)=>({x,z,label:`Canal bridge ${i*5+j+1}`,kind:'bridge' as const}))),
 ...([ [30,0],[-30,0],[90,60],[-90,-60],[0,-90],[0,90] ] as const).map(([x,z],i)=>({x,z,label:`Skybridge ${i+1}`,kind:'skybridge' as const,axis:i<4?'z' as const:'x' as const}))
];
const mapUI=createMinimap({
 roads,canals,
 buildings:solids.filter(s=>s.halfX>10&&s.halfZ>10),
 sightBlockers:sightBlockers.filter(b=>b.min.y<2.4&&b.max.y>1.6).map(b=>({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,halfX:(b.max.x-b.min.x)/2,halfZ:(b.max.z-b.min.z)/2})),
 points:mapPoints,
 collides,
 getState:()=>{
   const target=activeCar||player;
   const motion=activeCar?carMotion.get(activeCar):undefined;
   const heading=motion?vehicleMapHeading(target.rotation.y,motion.vx,motion.vz):target.rotation.y;
   return {position:{x:target.position.x,z:target.position.z},heading,
     wanted,completed:save.completed,missionActive,
     police: wanted>0 ? units.slice(0,policeByWanted[wanted]).map(u=>({x:u.car.position.x,z:u.car.position.z,heading:u.car.rotation.y,range:u.recovery>0?0:POLICE_CAR_VISION_RANGE,fov:POLICE_VISION_FOV,detected:u.recovery<=0&&policeCanSee(u.car,target.position,POLICE_CAR_VISION_RANGE)})) : [],
     officers: wanted>0 ? units.slice(0,policeByWanted[wanted]).filter(u=>u.officer).map(u=>({x:u.officer!.position.x,z:u.officer!.position.z,heading:u.officer!.rotation.y,range:POLICE_OFFICER_VISION_RANGE,fov:POLICE_VISION_FOV,detected:policeCanSee(u.officer!,target.position,POLICE_OFFICER_VISION_RANGE)})) : [],
     helicopter:helicopterVisible?{x:helicopter.g.position.x,z:helicopter.g.position.z}:null};
 }
});

let last=performance.now();function loop(now:number){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.05);last=now;
if(arrestSequence>0){arrestSequence-=dt;if(arrestSequence<=0)finishArrest();renderer.render(scene,camera);return;}
if(grapple){
  updateGrapple(dt);
  updateHelicopter(dt,now,player);mapUI.draw(now);
  damageFlash=Math.max(0,damageFlash-dt);
  camera.position.lerp(player.position.clone().add(new THREE.Vector3(6,8,-12)),Math.min(1,dt*4));
  camera.lookAt(player.position.x,2.1,player.position.z);
  healthHud.innerHTML=`<strong>HEALTH ${Math.ceil(health)}%</strong><div class="hud-meter health-meter"><span style="width:${health}%"></span></div>`;
  renderer.render(scene,camera);return;
}
struggleImmunity=Math.max(0,struggleImmunity-dt);
if(mapUI.isOpen())clearKeys();
let target=activeCar||player;
const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
const turn=(keys.has('a')||keys.has('arrowleft')?1:0)-(keys.has('d')||keys.has('arrowright')?1:0);
for(const motion of carMotion.values())motion.driven=false;
if(activeCar){
  const state=carMotion.get(activeCar)!;
  updateDrivenVehicle(activeCar,state,dt,forward,turn,keys.has(' '),carDamage(activeCar),save.upgrades);
  smoothedSteer=state.steer;
}else{
  player.rotation.y+=turn*dt*2.7;
  const delta=new THREE.Vector3(0,0,forward*dt*(keys.has('shift')?14:8)).applyAxisAngle(new THREE.Vector3(0,1,0),player.rotation.y);
  moveWithCollision(player,delta.x,delta.z,.85,[...cars,...police,...npcs,...units.flatMap(u=>u.officer?[u.officer]:[])]);
  animateHuman(player,dt,forward);
}
// Police set velocity targets before one shared integration, never a second translation.
const {anyGroundSight}=updatePolice(dt,target);
target=activeCar||player;
const previousPosition=activeCar?.position.clone();
const previousCarPose:VehicleHitPose|null=activeCar?{x:activeCar.position.x,z:activeCar.position.z,heading:activeCar.rotation.y}:null;
const impactSpeed=activeCar?vehicleSpeed(activeCar):0;
simulateVehicles(dt);
if(activeCar&&previousPosition&&impactSpeed>=4)sweepPedestrians(previousPosition,activeCar.position.clone().sub(previousPosition),impactSpeed);
if(activeCar&&previousCarPose)sweepOfficers(previousCarPose,{x:activeCar.position.x,z:activeCar.position.z,heading:activeCar.rotation.y},impactSpeed);
velocity=activeCar?forwardSpeed(activeCar,carMotion.get(activeCar)!):0;
for(const car of allVehicles){
  const state=carMotion.get(car)!;
  updateVehicleVisuals(car,dt,forwardSpeed(car,state),state.steer,state.braking,state.acceleration,state.lateralAcceleration);
}
target.position.x=THREE.MathUtils.clamp(target.position.x,-240,240);target.position.z=THREE.MathUtils.clamp(target.position.z,-240,240);
const offset=new THREE.Vector3(0,activeCar?14:9,activeCar?-24:-17).applyAxisAngle(new THREE.Vector3(0,1,0),target.rotation.y);camera.position.lerp(target.position.clone().add(offset),Math.min(1,dt*5));camera.lookAt(target.position.x,activeCar?2:2,target.position.z);
if(missionActive){const m=missions[save.completed%missions.length];if(Math.hypot(target.position.x-m.x,target.position.z-m.z)<9){missionActive=false;save.cash+=m.reward;save.rep+=25;save.completed++;persist();toast(`Mission complete! +$${m.reward} · +25 reputation`);setWanted(Math.max(wanted,2));toast('Mission complete! Police alerted — lose pursuit!')}}
// Police remember your last location, and wanted stars decay only while unseen.
updateHelicopter(dt,now,target);
detected=wanted>0&&(anyGroundSight||helicopterSeesPlayer);
if(wanted>0){
  if(detected)cooldown=10+wanted*4;
  else{
    cooldown=Math.max(0,cooldown-dt);
    if(cooldown<=0){
      setWanted(wanted-1);
      if(wanted===0)toast('ESCAPED — All wanted stars cleared!');
      else toast(`Wanted reduced to ${wanted} stars. Stay hidden!`);
    }
  }
}
// Short-lived non-gore shot tracers, plus health recovery after escape.
for(let i=shots.length-1;i>=0;i--){
  shots[i].ttl-=dt;
  const matShot=shots[i].line.material as THREE.LineBasicMaterial;
  matShot.opacity=Math.max(0,shots[i].ttl/.17);
  if(shots[i].ttl<=0){scene.remove(shots[i].line);shots[i].line.geometry.dispose();matShot.dispose();shots.splice(i,1)}
}
damageFlash=Math.max(0,damageFlash-dt);
if(!detected&&health<100)health=Math.min(100,health+dt*1.1);
for(let i=0;i<npcs.length;i++){
  const p=npcs[i];p.rotation.y+=Math.sin(now*.0003+i)*dt*.3;
  const delta=new THREE.Vector3(0,0,dt*.75).applyAxisAngle(new THREE.Vector3(0,1,0),p.rotation.y);
  const blocked=moveWithCollision(p,delta.x,delta.z,.8,[...cars,...police,...npcs,player]);
  animateHuman(p,dt,blocked?0:.55);
  if(blocked)p.rotation.y+=Math.PI*.7;
}
for(let i=ragdolls.length-1;i>=0;i--){if(!ragdolls[i].update(dt)){ragdolls[i].dispose(scene);ragdolls.splice(i,1)}}
for(let i=moneyDrops.length-1;i>=0;i--){
  const drop=moneyDrops[i];drop.age+=dt;
  drop.group.rotation.y+=dt*1.6;
  drop.group.position.y=drop.initialY+Math.sin(drop.age*4)*.13;
  if(Math.hypot(target.position.x-drop.group.position.x,target.position.z-drop.group.position.z)<3.5){
    save.cash+=drop.cash;save.rep+=2;persist();toast(`Picked up $${drop.cash}`);
    scene.remove(drop.group);moneyDrops.splice(i,1);
  }else if(drop.age>38){scene.remove(drop.group);moneyDrops.splice(i,1)}
}
// Maintain pedestrian population gradually; victims are not restored instantly.
while(respawnQueue.length&&respawnQueue[0]<=now/1000){respawnQueue.shift();spawnPedestrian(pedestrianId++)}
// Fade nearby roof canopies for a more readable third-person camera.
for(const roof of coverRoofs){
  const near=roof.mesh.position.distanceTo(camera.position)<19 &&
    Math.abs(roof.mesh.position.x-target.position.x)<15 && Math.abs(roof.mesh.position.z-target.position.z)<15;
  roof.material.opacity=THREE.MathUtils.lerp(roof.material.opacity,near ? .3 : 1,Math.min(1,dt*7));
}
const beneathCover=sightBlockers.some(b=>b.min.y>4 && b.max.y<16 &&
  target.position.x>b.min.x+.4 && target.position.x<b.max.x-.4 &&
  target.position.z>b.min.z+.4 && target.position.z<b.max.z-.4);
coverEl.textContent=wanted===5?
  (helicopterSeesPlayer?'🚁 HELICOPTER: SPOTTED — Find a roof or bridge!':beneathCover?'🚁 HELICOPTER: HIDDEN UNDER COVER':'🚁 HELICOPTER: SEARCHING — Stay concealed'):
  (beneathCover?'UNDER COVER — Helicopter hiding spot':'');
coverEl.className=wanted===5?(helicopterSeesPlayer?'exposed':'hidden'):'';
const m=missions[save.completed%missions.length];missionMarkers.forEach((o,i)=>{o.visible=i===save.completed%missions.length&&missionActive;o.rotation.y+=dt});startMarker.visible=!missionActive;startMarker.rotation.y+=dt;stats.innerHTML=`<b>$${Math.floor(save.cash)}</b> · REP ${save.rep} · MISSIONS ${save.completed} · UPGRADES ${save.upgrades}`;wantedEl.innerHTML=`<b>WANTED LEVEL</b><span class="stars">${'★'.repeat(wanted)}${'☆'.repeat(5-wanted)}</span><small>${wanted===0?'CLEAR — No police pursuit':wanted===5?'MAXIMUM ALERT — HELICOPTER ACTIVE':'POLICE ALERT — Escape the patrols'}</small>`;wantedEl.className=wanted>0?'alert':'';
const cdDuration=10+wanted*4;
policeHud.innerHTML=wanted>0?`<strong>${detected?'🔴 SPOTTED — ESCAPE!':'🟢 HIDDEN — WANTED COOLDOWN'}</strong><div class="hud-meter"><span style="width:${100*(1-cooldown/cdDuration)}%"></span></div><small>${detected?'Break line of sight to start cooldown':`${Math.ceil(cooldown)}s until next star clears`}</small>${arrestProgress>0?`<strong class="arrest-warning">OFFICER CLOSING — ${Math.max(.1,1.25-arrestProgress).toFixed(1)}s</strong>`:''}${activeCar&&units.some(u=>u.pullProgress>.05)?`<strong class="arrest-warning">OFFICER AT DOOR — KEEP MOVING!</strong>`:''}`:'';
healthHud.innerHTML=`<strong>HEALTH ${Math.ceil(health)}%</strong><div class="hud-meter health-meter"><span style="width:${health}%"></span></div>`;
vehicleHud.innerHTML=activeCar?`<strong>VEHICLE · ${Math.round(vehicleSpeed(activeCar)*2.2)} MPH</strong><div class="hud-meter car-meter"><span style="width:${carDamage(activeCar)}%"></span></div><small>Body damage: ${Math.round(carDamage(activeCar))}% · ${carDamage(activeCar)>50?'Handling impaired':'Drive carefully'} · Garage repairs</small>`:'';
missionEl.innerHTML=missionActive?`<b>${m.title}</b><br>${m.desc}<br>Reach the yellow marker`: `<b>Next: ${m.title}</b><br>Visit the yellow marker near the center and press E`;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toastEl.textContent=''}mapUI.draw(now);renderer.render(scene,camera)}requestAnimationFrame(loop);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
toast('Welcome to NeO 777 Alpha 1.2 — Momentum, police vision & COOKED!');
