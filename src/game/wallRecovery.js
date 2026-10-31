/** Gentler wall contact for both race modes: instead of bouncing a kart backwards and
 * leaving it nose-first into the barrier, turn it to run along the wall and keep most
 * of its momentum, so the driver can carry on without reversing out.
 */
export const WALL_RECOVERY=Object.freeze({turnShare:.7,keepSpeed:.72,inset:.25})

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a))

// (tx,tz) is the road direction at the contact point. The kart turns towards whichever
// way along the wall is closest to where it was already heading.
export function deflectAlongWall(yaw,tx,tz,share=WALL_RECOVERY.turnShare){
 const along=Math.atan2(-tx,-tz)
 const forwardGap=wrap(along-yaw),backwardGap=wrap(along+Math.PI-yaw)
 const gap=Math.abs(forwardGap)<=Math.abs(backwardGap)?forwardGap:backwardGap
 return wrap(yaw+gap*share)
}

// Forward momentum is mostly kept; a reversing kart just stops at the wall.
export function wallSpeed(speed){
 return speed>0?speed*WALL_RECOVERY.keepSpeed:Math.max(speed*.2,-1)
}
