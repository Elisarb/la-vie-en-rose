import {dayHours,workingReady,isWorking} from './hours.js';
export const defaultSlots = () => [{start:'10:00',end:'13:00'},{start:'13:00',end:'17:00'},{start:'17:00',end:'20:30'}];
export function validateSlots(slots) {
  if(!Array.isArray(slots)||slots.length!==3) throw new Error('INVALID_SCHEDULE');
  let previous='00:00';
  for(const s of slots){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||s.start>=s.end||s.start<previous)throw new Error('INVALID_SCHEDULE');previous=s.end;}
  return slots;
}
export function madridLocal(date) {
  const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const p=k=>parts.find(x=>x.type===k).value;
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`;
}
export function fromMadrid(value) {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||'')) throw new Error('INVALID_SCHEDULE');
  const guess=new Date(`${value}Z`);
  for(const offset of [120,60]){const d=new Date(guess.getTime()-offset*60000);if(madridLocal(d)===value)return d;}
  throw new Error('INVALID_SCHEDULE');
}
export function availableSlots(date,settings,now=new Date()) {
  const ready=workingReady(now,settings.deliveryLeadMinutes,settings.hours);
  return (settings.hours?.deliverySlots||defaultSlots()).map((slot,index)=>{
    const start=fromMadrid(`${date}T${slot.start}`),end=fromMadrid(`${date}T${slot.end}`),day=dayHours(start,settings.hours);
    return {...slot,index,available:start>=ready&&!day.closed&&day.minute>=day.start&&dayHours(end,settings.hours).minute<=day.end};
  });
}
export function validateSelection(payload,settings,now=new Date()) {
  if(payload.fulfillment==='delivery') {
    const slot=availableSlots(payload.deliveryDate,settings,now).find(s=>s.index===Number(payload.deliverySlot)&&s.available);
    if(!slot)throw new Error('INVALID_SCHEDULE');
    return {deliveryAt:fromMadrid(`${payload.deliveryDate}T${slot.start}`).toISOString(),deliveryWindow:`${slot.start}–${slot.end}`,pickupAt:''};
  }
  const pickup=fromMadrid(payload.pickupLocal);
  if(pickup<workingReady(now,settings.pickupLeadMinutes,settings.hours)||!isWorking(pickup,settings.hours,true))throw new Error('INVALID_SCHEDULE');
  return {pickupAt:pickup.toISOString(),deliveryAt:'',deliveryWindow:''};
}
