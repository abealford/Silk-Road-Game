// ============================================================
//  v22.4 ATMOSPHERE: patches to three.js's shared shader chunks
//  - soft sun shadows whose edges widen with distance from the caster (PCSS-style, replaces PCFSoft)
//  - drifting cloud shadows on everything the sun lights
//  Loaded before game.js so every lit material compiles with them.
// ============================================================
(() => {
  const C = THREE.ShaderChunk, L = THREE.ShaderLib;
  // uniforms shared by reference with every Lambert/Phong material (typed arrays are not copied by UniformsUtils.clone)
  // uCloudSh: drift x, drift z, cover (0..1), strength (0 = off)
  // uSoftSh: softness (metres of penumbra per metre of caster height), max penumbra in texels, shadow box width (m), shadow depth range (m)
  const ATMOS = window.ATMOS = { cloud: new Float32Array([0, 0, 0.55, 0]), soft: new Float32Array([0.07, 14, 160, 1799]) };
  for (const k of ['lambert', 'phong', 'standard', 'physical', 'toon']) if (L[k]) { L[k].uniforms.uCloudSh = { value: ATMOS.cloud }; L[k].uniforms.uSoftSh = { value: ATMOS.soft }; }

  // ---- soft shadows ----
  let s = C.shadowmap_pars_fragment;
  const a = s.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )'), b = s.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )');
  if (a > 0 && b > a) {
    s = s.slice(0, a) + `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			// v22.4: blocker search, then a rotated Vogel-disc PCF whose radius grows with the caster-receiver gap
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float wpt = uSoftSh.z / shadowMapSize.x;
			float ang = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
			mat2 rot = mat2( cos( ang ), sin( ang ), - sin( ang ), cos( ang ) );
			float bsum = 0.0, bn = 0.0;
			for ( int i = 0; i < 8; i ++ ) {
				vec2 o = rot * atmVogel( i, 8.0 ) * uSoftSh.y * texelSize;
				float d = unpackRGBAToDepth( texture2D( shadowMap, shadowCoord.xy + o ) );
				if ( d < shadowCoord.z ) { bsum += d; bn += 1.0; }
			}
			if ( bn > 0.5 ) {
				float gap = max( shadowCoord.z - bsum / bn, 0.0 ) * uSoftSh.w;
				float pen = clamp( gap * uSoftSh.x / wpt, 1.1, uSoftSh.y );
				float acc = 0.0;
				for ( int i = 0; i < 12; i ++ ) acc += texture2DCompare( shadowMap, shadowCoord.xy + rot * atmVogel( i, 12.0 ) * pen * texelSize, shadowCoord.z );
				shadow = acc / 12.0;
			}
		` + s.slice(b);
    s = s.replace('float getShadow( sampler2D shadowMap,', `uniform vec4 uSoftSh;
	vec2 atmVogel( int i, float n ) { float fi = float( i ); float r = sqrt( ( fi + 0.5 ) / n ); float th = fi * 2.39996323; return vec2( cos( th ), sin( th ) ) * r; }
	float getShadow( sampler2D shadowMap,`);
    C.shadowmap_pars_fragment = s;
  } else console.warn('atmos: shadow chunk not patched');

  // ---- cloud shadows ----
  C.lights_pars_begin += `
uniform vec4 uCloudSh;
float atmH( vec2 p ) { p = fract( p * vec2( 233.34, 851.73 ) ); p += dot( p, p + 23.45 ); return fract( p.x * p.y ); }
float atmN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( atmH( i ), atmH( i + vec2( 1.0, 0.0 ) ), f.x ), mix( atmH( i + vec2( 0.0, 1.0 ) ), atmH( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
float atmCloud( vec3 viewPos ) {
  if ( uCloudSh.w <= 0.0 ) return 1.0;
  vec3 wp = cameraPosition + transpose( mat3( viewMatrix ) ) * viewPos;
  vec2 q = wp.xz * 0.0042 + uCloudSh.xy;
  float n = atmN( q ) * 0.62 + atmN( q * 2.17 + 5.3 ) * 0.28 + atmN( q * 5.1 - 2.1 ) * 0.1;
  float t = 1.02 - uCloudSh.z * 0.62;
  return 1.0 - smoothstep( t - 0.06, t + 0.1, n ) * uCloudSh.w;
}
`;
  const lf = 'getDirectionalLightInfo( directionalLight, directLight );';
  if (C.lights_fragment_begin.indexOf(lf) >= 0) C.lights_fragment_begin = C.lights_fragment_begin.replace(lf, lf + '\n\t\tdirectLight.color *= atmCloud( geometryPosition );');
  else console.warn('atmos: light chunk not patched');
})();
