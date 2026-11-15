const SHAPES={sil:[0,1,'閉じる'],PP:[0,1,'閉じる'],FF:[.12,1,'子音'],TH:[.16,1,'子音'],DD:[.12,1,'子音'],kk:[.12,1,'子音'],CH:[.28,.85,'う'],SS:[.1,1.1,'子音'],nn:[0,1,'閉じる'],RR:[.3,.9,'う'],aa:[1,1.05,'あ'],E:[.58,1.15,'え'],ih:[.34,1.2,'い'],oh:[.85,.85,'お'],ou:[.43,.78,'う']};
export class VoicePlayer{
 constructor(onState){this.onState=onState;this.playing=false;this.amount=0;this.width=1;this.label='待機中';this.token=0;this.values=new Float32Array(1024);}
 async unlock(){if(!this.ctx){this.ctx=new AudioContext();this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=1024;this.analyser.connect(this.ctx.destination);}await this.ctx.resume();}
 stop(){this.token++;if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}this.playing=false;this.amount=0;this.label='待機中';this.onState?.(false);}
 async load(job){await this.unlock();const [audio,score]=await Promise.all([fetch(job.audio).then(r=>{if(!r.ok)throw Error('音声を読み込めません');return r.arrayBuffer();}),fetch(job.score).then(r=>{if(!r.ok)throw Error('口パクデータを読み込めません');return r.json();})]);return {buffer:await this.ctx.decodeAudioData(audio),score,job};}
 async play(data, canStart = () => true) {
  await this.unlock();
  if (!canStart()) return;
  this.stop();
  this.data = data;
  const token = this.token;
  this.source = this.ctx.createBufferSource();
  this.source.buffer = data.buffer;
  this.source.connect(this.analyser);
  this.startedAt = this.ctx.currentTime;
  this.source.onended = () => {
   if (this.token !== token) return;
   this.playing = false;
   this.amount = 0;
   this.label = '待機中';
   this.onState?.(false, true);
  };
  this.source.start();
  this.playing = true;
  this.onState?.(true);
 }
 sample(){
  const t=this.playing?Math.max(0,this.ctx.currentTime-this.startedAt):0;this.elapsed=t;
  let target=0,width=1;this.label='待機中';
  if(this.playing){const events=this.data.score.visemes;let lo=0,hi=events.length-1,viseme='sil';while(lo<=hi){const mid=(lo+hi)>>1;if(events[mid][0]<=t){viseme=events[mid][1];lo=mid+1;}else hi=mid-1;}
   const shape=SHAPES[viseme]||SHAPES.sil;this.analyser.getFloatTimeDomainData(this.values);let sum=0;for(const v of this.values)sum+=v*v;const rms=Math.sqrt(sum/this.values.length);const level=Math.min(1,Math.max(0,(rms-.004)*15));target=shape[0]*(level>.02?.45+.55*level:0);width=shape[1];this.label=rms<.005?'…':shape[2];this.viseme=viseme;this.rms=rms;
  }
  this.amount+=(target-this.amount)*(target>this.amount?.55:.65);this.width+=(width-this.width)*.45;return this.amount;
 }
 dispose(){this.stop();this.ctx?.close();}
}
