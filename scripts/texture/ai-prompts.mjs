#!/usr/bin/env node
// Print AI image-generation prompts for each rock species.
// Usage: npm run textures:prompts [-- --species granite]

const PROMPTS = {
  granite: {
    albedo: 'seamless tileable granite rock surface texture, coarse gray-pink mineral grains, subtle quartz flecks, macro photography, flat lit, top-down, 512x512, game PBR albedo, no shadows',
    normal: 'seamless granite rock normal map, fine bump detail from mineral crystals, flat neutral blue-purple normal map, tileable, 512x512',
    roughness: 'seamless granite roughness map, matte weathered stone, medium-high roughness variation, grayscale tileable 512x512',
    ao: 'seamless granite ambient occlusion map, dark crevices between mineral grains, white exposed faces, grayscale tileable 512x512, no color',
  },
  sandstone: {
    albedo: 'seamless sandstone rock texture, warm tan sedimentary layers, horizontal stratification, desert weathering, flat lit tileable PBR albedo 512x512',
    normal: 'sandstone normal map, layered sediment bumps, subtle erosion grooves, tileable game texture 512x512',
    roughness: 'sandstone roughness map, soft matte sedimentary stone, tileable grayscale 512x512',
    ao: 'sandstone ambient occlusion map, dark gaps between sediment layers, white exposed bedding, grayscale tileable 512x512',
  },
  basalt: {
    albedo: 'seamless basalt rock texture, dark charcoal volcanic stone, columnar fracture hints, fine grain, flat lit tileable PBR albedo 512x512',
    normal: 'basalt rock normal map, angular volcanic fracture detail, tileable 512x512',
    roughness: 'basalt roughness map, slightly glossy dark volcanic rock, tileable grayscale 512x512',
    ao: 'basalt ambient occlusion map, dark fracture lines and vesicle shadows, white exposed faces, grayscale tileable 512x512',
  },
  limestone: {
    albedo: 'seamless limestone texture, pale cream karst stone, subtle pitting and fossils, flat lit tileable PBR albedo 512x512',
    normal: 'limestone normal map, dissolution pits and soft bumps, tileable 512x512',
    roughness: 'limestone roughness map, chalky matte stone, tileable grayscale 512x512',
    ao: 'limestone ambient occlusion map, dark dissolution pits and pores, white raised surfaces, grayscale tileable 512x512',
  },
  volcanic: {
    albedo: 'seamless volcanic tuff texture, porous vesicular brown-red rock, pumice holes, flat lit tileable PBR albedo 512x512',
    normal: 'volcanic tuff normal map, deep pores and cavities, tileable 512x512',
    roughness: 'volcanic tuff roughness map, very rough porous stone, tileable grayscale 512x512',
    ao: 'volcanic tuff ambient occlusion map, deep pore and cavity shadows, white rim highlights, grayscale tileable 512x512',
  },
  glacial: {
    albedo: 'seamless glacial erratic rock texture, blue-gray frost-scoured granite, ice polish streaks, alpine weathering, flat lit tileable PBR albedo 512x512',
    normal: 'glacial rock normal map, glacial striations and chatter marks, tileable 512x512',
    roughness: 'glacial rock roughness map, mixed polished and rough ice-scoured patches, tileable grayscale 512x512',
    ao: 'glacial rock ambient occlusion map, dark striation grooves and chatter marks, white polished patches, grayscale tileable 512x512',
  },
  river_cobble: {
    albedo: 'seamless river cobble stone texture, smooth water-worn rounded pebbles, mixed gray-brown, flat lit tileable PBR albedo 512x512',
    normal: 'river cobble normal map, smooth worn pebble surface, subtle bumps, tileable 512x512',
    roughness: 'river cobble roughness map, wet-smooth stone patches, tileable grayscale 512x512',
    ao: 'river cobble ambient occlusion map, dark gaps between rounded pebbles, white worn stone tops, grayscale tileable 512x512',
  },
  karst: {
    albedo: 'seamless karst limestone texture, pale rock with dissolution pits and sharp eroded ridges, cave-weathered, flat lit tileable PBR albedo 512x512',
    normal: 'karst limestone normal map, deep pits and sharp karren ridges, tileable 512x512',
    roughness: 'karst rock roughness map, varied weathered limestone, tileable grayscale 512x512',
    ao: 'karst limestone ambient occlusion map, dark dissolution pits and sharp karren shadows, white ridges, grayscale tileable 512x512',
  },
  schist: {
    albedo: 'seamless schist metamorphic rock texture, dark gray flaky foliated layers, mica flecks, flat lit tileable PBR albedo 512x512',
    normal: 'schist rock normal map, fine foliation lamination bumps, tileable 512x512',
    roughness: 'schist roughness map, layered matte metamorphic stone, tileable grayscale 512x512',
    ao: 'schist ambient occlusion map, dark foliation gaps between flaky layers, white mica flecks, grayscale tileable 512x512',
  },
};

const speciesArg = process.argv.includes('--species')
  ? process.argv[process.argv.indexOf('--species') + 1]
  : null;

const entries = speciesArg
  ? [[speciesArg, PROMPTS[speciesArg]]]
  : Object.entries(PROMPTS);

if (speciesArg && !PROMPTS[speciesArg]) {
  console.error(`Unknown species: ${speciesArg}`);
  console.error('Available:', Object.keys(PROMPTS).join(', '));
  process.exit(1);
}

for (const [id, prompts] of entries) {
  console.log(`\n=== ${id} ===\n`);
  for (const [ch, text] of Object.entries(prompts)) {
    console.log(`[${ch}]`);
    console.log(text);
    console.log('');
  }
}

console.log('After generation, ingest with:');
console.log('  npm run textures:ingest -- --species <id> --dir ./ai-output/');
