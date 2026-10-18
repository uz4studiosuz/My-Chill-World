import * as THREE from 'three';
/** Deterministic ridgelines, irregular slopes and a snow cap. */
export function mountainGeometry(){
  const points:number[]=[],colours:number[]=[],indices:number[]=[],rings=8,sides=14;
  for(let ring=0;ring<rings;ring++){
    const t=ring/(rings-1),radius=1.63*(1-t*.96),y=t*3.5;
    for(let i=0;i<sides;i++){
      const a=i/sides*Math.PI*2,noise=1+.14*Math.sin(i*3.7+ring*.8);
      points.push(Math.cos(a)*radius*noise+t*.25,y,Math.sin(a)*radius*.9*noise-t*.18);
      const c=new THREE.Color(t>.77?'#f2f4f6':i%3===0?'#7d807a':i%2?'#96958d':'#a7a397');colours.push(c.r,c.g,c.b);
      if(ring<rings-1){const a0=ring*sides+i,b0=ring*sides+(i+1)%sides,c0=b0+sides,d0=a0+sides;indices.push(a0,d0,b0,b0,d0,c0);}
    }
  }
  const top=points.length/3;points.push(.25,3.54,-.18);const snow=new THREE.Color('#f2f4f6');colours.push(snow.r,snow.g,snow.b);
  for(let i=0;i<sides;i++)indices.push((rings-1)*sides+i,top,(rings-1)*sides+(i+1)%sides);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.setIndex(indices);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
