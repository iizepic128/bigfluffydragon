/** Live city radar and navigable full map. All coordinates are the game's X/Z plane. */
import { policeVisionOutline, type PoliceSightBlocker } from './policeVision';
export type MapPoint = {x:number;z:number;label:string;kind:'mission'|'shop'|'shelter'|'skybridge'|'bridge';axis?:'x'|'z'};
type Coord = {x:number;z:number};
type PoliceMapPoint = Coord & {heading:number;range:number;fov:number;detected:boolean};
type MapState = {position:Coord;heading:number;police:PoliceMapPoint[];officers:PoliceMapPoint[];helicopter:Coord|null;wanted:number;missionActive:boolean;completed:number};
type MapConfig = {roads:number[];canals:number[];buildings:PoliceSightBlocker[];sightBlockers?:PoliceSightBlocker[];points:MapPoint[];getState:()=>MapState;collides:(x:number,z:number,r:number)=>boolean};
const WORLD=250,GRID=10,MIN=-240,SIZE=49;
const colors={mission:'#ffda65',shop:'#70fbb5',shelter:'#55e9ef',skybridge:'#8ac9ff',bridge:'#92b3eb'};
const distance=(a:Coord,b:Coord)=>Math.hypot(a.x-b.x,a.z-b.z);
const goalID=(p:Coord)=>`${p.x},${p.z}`;

export function createMinimap(config:MapConfig){
  const radar=document.querySelector<HTMLCanvasElement>('#minimap')!;
  const big=document.querySelector<HTMLCanvasElement>('#worldmap')!;
  const overlay=document.querySelector<HTMLElement>('#map-overlay')!;
  const hud=document.querySelector<HTMLElement>('#gps-status')!;
  const selectedLabel=document.querySelector<HTMLElement>('#map-destination')!;
  const close=document.querySelector<HTMLButtonElement>('#close-map')!;
  const open=document.querySelector<HTMLButtonElement>('#open-map')!;
  const defaultButton=document.querySelector<HTMLButtonElement>('#mission-route')!;
  const zoomIn=document.querySelector<HTMLButtonElement>('#radar-zoom-in')!;
  const zoomOut=document.querySelector<HTMLButtonElement>('#radar-zoom-out')!;
  let range=88;
  let customDestination:MapPoint|null=null;
  let lastRouteFrom:Coord={x:9999,z:9999};
  let lastDestination='';
  let lastCompute=0;
  let route:Coord[]=[];
  let lastDraw=0;

  const origin:MapPoint={x:-7,z:-7,label:'Mission contact',kind:'mission'};
  function missionPoint(s:MapState):MapPoint{
    if(s.missionActive){
      const jobs=config.points.filter(p=>p.kind==='mission');
      return jobs[s.completed%jobs.length]||origin;
    }
    return origin;
  }
  function destination(s:MapState):MapPoint{return customDestination||missionPoint(s)}
  function passable(gx:number,gz:number):boolean{
    if(gx<0||gz<0||gx>=SIZE||gz>=SIZE)return false;
    return !config.collides(MIN+gx*GRID,MIN+gz*GRID,2.3);
  }
  const toGrid=(v:number)=>Math.max(0,Math.min(SIZE-1,Math.round((v-MIN)/GRID)));
  function closestFree(p:Coord){
    let x=toGrid(p.x),z=toGrid(p.z);
    if(passable(x,z))return {x,z};
    for(let radius=1;radius<SIZE;radius++)for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
      if(Math.max(Math.abs(dx),Math.abs(dz))===radius&&passable(x+dx,z+dz))return {x:x+dx,z:z+dz};
    }
    return {x,z};
  }
  // A* on a lightweight grid. Prefer streets, avoid buildings and water except real bridges.
  function findRoute(from:Coord,to:Coord):Coord[]{
    const start=closestFree(from),end=closestFree(to);
    const startKey=start.z*SIZE+start.x,endKey=end.z*SIZE+end.x;
    const total=SIZE*SIZE;
    const costs=new Float64Array(total).fill(Infinity),parents=new Int32Array(total).fill(-1),closed=new Uint8Array(total);
    const frontier:{id:number;f:number}[]=[];
    const heuristic=(x:number,z:number)=>Math.abs(end.x-x)+Math.abs(end.z-z);
    costs[startKey]=0;frontier.push({id:startKey,f:heuristic(start.x,start.z)});
    let iterations=0;
    while(frontier.length && iterations++<total*5){
      frontier.sort((a,b)=>a.f-b.f);
      const {id}=frontier.shift()!;
      if(closed[id])continue;
      closed[id]=1;
      if(id===endKey)break;
      const x=id%SIZE,z=Math.floor(id/SIZE);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,nz=z+dz;
        if(!passable(nx,nz))continue;
        const nid=nz*SIZE+nx;if(closed[nid])continue;
        const wx=MIN+nx*GRID,wz=MIN+nz*GRID;
        const onStreet=config.roads.some(road=>Math.abs(wx-road)<10.5||Math.abs(wz-road)<10.5);
        const candidate=costs[id]+(onStreet?1:3.2);
        if(candidate<costs[nid]){costs[nid]=candidate;parents[nid]=id;frontier.push({id:nid,f:candidate+heuristic(nx,nz)})}
      }
    }
    if(!Number.isFinite(costs[endKey]))return [from,to];
    const path:Coord[]=[];
    for(let node=endKey,c=0;node!==-1&&c++<total;node=parents[node]){
      path.push({x:MIN+(node%SIZE)*GRID,z:MIN+Math.floor(node/SIZE)*GRID});
      if(node===startKey)break;
    }
    path.reverse();
    // Remove points on straight stretches, keeping turns clear on the GPS.
    const simplified:Coord[]=[from];
    for(let i=0;i<path.length;i++){
      const a=path[i-1],b=path[i],c=path[i+1];
      if(!a||!c|| (b.x-a.x)*(c.z-b.z)!==(b.z-a.z)*(c.x-b.x))simplified.push(b);
    }
    simplified.push(to);
    return simplified;
  }
  const isOpen=()=>!overlay.hidden;
  const toggle=(show?:boolean)=>{
    overlay.hidden=show===undefined?!overlay.hidden:!show;
    document.body.classList.toggle('map-is-open',!overlay.hidden);
    if(!overlay.hidden)drawMap(big,true,config.getState());
  };
  open.addEventListener('click',()=>toggle(true));
  close.addEventListener('click',()=>toggle(false));
  overlay.addEventListener('click',event=>{if(event.target===overlay)toggle(false)});
  window.addEventListener('keydown',event=>{
    if(event.key.toLowerCase()==='m'&&!event.repeat){event.preventDefault();toggle()}
    if(event.key==='Escape'&&isOpen()){event.preventDefault();toggle(false)}
  });
  defaultButton.addEventListener('click',()=>{
    customDestination=null;lastDestination='';draw(performance.now(),true);
  });
  zoomIn.addEventListener('click',()=>{range=Math.max(45,range-23);draw(performance.now(),true)});
  zoomOut.addEventListener('click',()=>{range=Math.min(180,range+23);draw(performance.now(),true)});

  // A marker click on the expanded map selects a real GPS destination.
  big.addEventListener('click',event=>{
    const b=big.getBoundingClientRect(),x=(event.clientX-b.left)/b.width*big.width,z=(event.clientY-b.top)/b.height*big.height;
    const scale=big.width/(WORLD*2+25);
    const clickAt={x:(x-big.width/2)/scale,z:(big.height/2-z)/scale};
    const list=[origin,...config.points];
    const closest=list.reduce<MapPoint|null>((best,p)=>!best||distance(p,clickAt)<distance(best,clickAt)?p:best,null);
    if(closest&&distance(closest,clickAt)<18){customDestination=closest;lastDestination='';draw(performance.now(),true)}
  });

  function drawMap(canvas:HTMLCanvasElement,full:boolean,s:MapState){
    const ctx=canvas.getContext('2d')!;if(!ctx)return;
    const w=canvas.width,h=canvas.height;
    const scale=full?w/(WORLD*2+25):w/(range*2);
    const center=full?{x:0,z:0}:s.position;
    const screen=(p:Coord)=>({x:w/2+(p.x-center.x)*scale,y:h/2-(p.z-center.z)*scale});
    function rect(p:Coord,sx:number,sz:number,color:string){
      const q=screen(p);ctx.fillStyle=color;ctx.fillRect(q.x-sx*scale/2,q.y-sz*scale/2,sx*scale,sz*scale);
    }
    ctx.clearRect(0,0,w,h);ctx.save();ctx.fillStyle='#102b35';ctx.fillRect(0,0,w,h);
    if(!full){ctx.beginPath();ctx.arc(w/2,h/2,w/2-4,0,Math.PI*2);ctx.clip()}
    for(let v=-240;v<=240;v+=30){
      const a=screen({x:v,z:240}),b=screen({x:v,z:-240});ctx.strokeStyle='#22515c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      const c=screen({x:-240,z:v}),d=screen({x:240,z:v});ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();
    }
    // Roads, waterways and navigable canal bridge decks.
    for(const rd of config.roads){rect({x:0,z:rd},500,15,'#485366');rect({x:rd,z:0},15,500,'#485366')}
    for(const canal of config.canals){rect({x:canal,z:0},19,495,'#165b90');rect({x:canal,z:0},2,495,'#2a94ce')}
    for(const canal of config.canals)for(const road of config.roads){rect({x:canal,z:road},26,16,'#a8a1b0')}
    ctx.strokeStyle='#d9ba74';ctx.lineWidth=Math.max(1,scale*.45);ctx.setLineDash([scale*2.5,scale*7]);
    for(const rd of config.roads){
      let a=screen({x:-245,z:rd}),b=screen({x:245,z:rd});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      a=screen({x:rd,z:-245});b=screen({x:rd,z:245});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    ctx.setLineDash([]);
    for(const b of config.buildings){rect(b,b.halfX*2,b.halfZ*2,'#182c41');rect(b,b.halfX*1.65,b.halfZ*1.65,'#304158')}
    for(const p of config.points){
      if(p.kind==='skybridge'){
        const vertical=p.axis==='z';
        rect(p,vertical?12:39,vertical?39:12,'#62cde777');
      }
      if(p.kind==='shelter')rect(p,28,28,'#27766c99');
    }
    // Render sight beneath routes, markers and the player; the radar clip also clips cones.
    if(s.wanted>0){
      const blockers=config.sightBlockers||config.buildings;
      function visionCone(p:PoliceMapPoint,color:string){
        if(!full&&distance(p,s.position)>range+p.range)return;
        const origin=screen(p);
        const edge=policeVisionOutline(p,p.range,p.fov,blockers);
        ctx.save();ctx.beginPath();ctx.moveTo(origin.x,origin.y);
        for(const point of edge){const q=screen(point);ctx.lineTo(q.x,q.y)}
        ctx.closePath();ctx.fillStyle=color;ctx.globalAlpha=p.detected ? .3 : .14;ctx.fill();
        ctx.strokeStyle=color;ctx.globalAlpha=p.detected ? .8 : .42;ctx.lineWidth=full?1.3:1.1;ctx.stroke();ctx.restore();
      }
      s.police.forEach(p=>visionCone(p,'#ff4966'));
      s.officers.forEach(p=>visionCone(p,'#ffab55'));
    }
    // GPS path and pulsing destination ring, clipped into radar.
    const target=destination(s);const toDraw=route.length?route:[s.position,target];
    ctx.beginPath();toDraw.forEach((p,i)=>{const c=screen(p);if(i===0)ctx.moveTo(c.x,c.y);else ctx.lineTo(c.x,c.y)});
    ctx.strokeStyle='#4bfaef33';ctx.lineWidth=full?12:11;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
    ctx.strokeStyle='#77ffec';ctx.lineWidth=full?4:3.5;ctx.setLineDash([12,9]);ctx.stroke();ctx.setLineDash([]);
    function circle(p:Coord,r:number,color:string,stroke='#0c1728'){
      const q=screen(p);ctx.beginPath();ctx.arc(q.x,q.y,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();return q;
    }
    function glyph(p:MapPoint){
      const q=screen(p);if(q.x<-15||q.x>w+15||q.y<-15||q.y>h+15)return;
      const targetNow=distance(p,target)<1;
      if(targetNow){ctx.strokeStyle='#ffffff';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(q.x,q.y,full?12:10,0,2*Math.PI);ctx.stroke()}
      const r=full?7:5.8;
      circle(p,r,colors[p.kind]);
      if(full){ctx.fillStyle='#d7f8ff';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(p.label,q.x,q.y-13)}
    }
    for(const p of config.points){
      // Hide minor landmarks on the compact radar unless nearby; keep all on full map.
      if(!full&&p.kind==='bridge'&&distance(p,s.position)>60)continue;
      glyph(p);
    }
    if(!s.missionActive)glyph(origin);
    if(s.wanted>0){
      s.police.forEach(p=>{
        const q=circle(p,full?7:6,'#ff4966');ctx.fillStyle='#fff';ctx.font=`bold ${full?10:9}px system-ui`;ctx.textAlign='center';ctx.fillText('P',q.x,q.y+3)
      });
      s.officers.forEach(p=>{const q=circle(p,full?6:5,'#ffab55');ctx.fillStyle='#192532';ctx.font=`bold ${full?9:8}px system-ui`;ctx.textAlign='center';ctx.fillText('O',q.x,q.y+3)});
      if(s.helicopter){const q=circle(s.helicopter,full?10:9,'#ed6cff');ctx.fillStyle='#180d2b';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('H',q.x,q.y+4)}
    }
    const pos=screen(s.position);
    ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(s.heading);
    ctx.shadowBlur=15;ctx.shadowColor='#65fff5';ctx.fillStyle='#efffff';ctx.strokeStyle='#043e55';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(-9,11);ctx.lineTo(0,6);ctx.lineTo(9,11);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    if(!full){
      ctx.strokeStyle='#51d9e6';ctx.lineWidth=4;ctx.beginPath();ctx.arc(w/2,h/2,w/2-3,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.fillText('N',w/2,23);
    }else{
      ctx.strokeStyle='#6c9cab';ctx.lineWidth=3;ctx.strokeRect(1,1,w-2,h-2);
      ctx.fillStyle='#c6eaf2';ctx.font='bold 16px system-ui';ctx.textAlign='left';ctx.fillText('N ↑',18,30);
    }
    ctx.restore();
  }

  function draw(now:number,force=false){
    if(!force&&now-lastDraw<95)return;
    lastDraw=now;
    const s=config.getState(),d=destination(s);
    if(force||goalID(d)!==lastDestination||(distance(lastRouteFrom,s.position)>12&&now-lastCompute>2200)){
      route=findRoute(s.position,d);lastDestination=goalID(d);lastRouteFrom={...s.position};lastCompute=now;
    }
    drawMap(radar,false,s);
    if(isOpen())drawMap(big,true,s);
    const meters=Math.round(distance(s.position,d));
    hud.textContent=`GPS  ·  ${d.label}  ·  ${meters}m`;
    selectedLabel.textContent=`Destination: ${d.label} (${meters}m). Click a map marker to reroute.`;
  }
  return {draw,isOpen};
}
