INSERT INTO patch (id, name, geo_bounds) VALUES
  ('patch_west_ox', 'West Oxfordshire', NULL);

INSERT INTO source (id, name, type, url, feed_url, terms_ok, active) VALUES
  ('src_witney_gazette', 'Witney Gazette', 'rss', 'https://witneygazette.co.uk', 'https://witneygazette.co.uk/rss', 1, 1);

INSERT INTO story (id, origin, patch_id, source_id, title, body, snippet, external_url, status, category, valence_score, published_at, created_at, updated_at) VALUES
  (
    'story_001',
    'aggregated',
    'patch_west_ox',
    'src_witney_gazette',
    'Eynsham community raises over 30,000 for new playground',
    'Residents of Eynsham have rallied together in an extraordinary fundraising effort, surpassing their original target to raise over 30,000 pounds for a brand-new community playground. The project, led by the Eynsham Parish Council alongside local volunteers, aims to replace the ageing play equipment at the village green with modern, accessible facilities suitable for children of all abilities. Local businesses contributed through sponsored events, bake sales, and a charity fun run that attracted over 200 participants. Construction is expected to begin this spring, with the playground set to open by summer.',
    'Residents of Eynsham have rallied together in an extraordinary fundraising effort, surpassing their original target to raise over 30,000 pounds for a new community playground.',
    'https://witneygazette.co.uk/eynsham-playground',
    'published',
    'community',
    9,
    datetime('now', '-2 hours'),
    datetime('now', '-2 hours'),
    datetime('now', '-2 hours')
  ),
  (
    'story_002',
    'submission',
    'patch_west_ox',
    NULL,
    'Local teenager wins national science award for water filtration project',
    'Fourteen-year-old Maya Chen from Carterton has been awarded first place at the National Young Scientist of the Year competition for her innovative water filtration device made from recycled materials. Maya spent over six months developing the prototype in her garden shed, using discarded plastic bottles and locally sourced charcoal. Her design can filter up to five litres of water per hour and removes over 95 percent of common contaminants. Judges praised the project for its practicality and environmental awareness. Maya plans to work with a local charity to trial the device in communities without reliable access to clean water.',
    'Fourteen-year-old Maya Chen from Carterton has won first place at the National Young Scientist of the Year competition for her innovative water filtration device made from recycled materials.',
    NULL,
    'published',
    'youth',
    10,
    datetime('now', '-5 hours'),
    datetime('now', '-5 hours'),
    datetime('now', '-5 hours')
  ),
  (
    'story_003',
    'aggregated',
    'patch_west_ox',
    'src_witney_gazette',
    'Witney woodland trust plants 2,000 native trees along Windrush valley',
    'The Witney Woodland Trust has completed its biggest planting season yet, with over 2,000 native trees now established along a two-mile stretch of the Windrush valley. Volunteers from across West Oxfordshire joined planting days throughout the autumn and winter months. The mix of oak, hazel, willow, and wild cherry was chosen to support local biodiversity and help manage flood risk downstream. The trust says the new woodland corridor will provide habitat for otters, kingfishers, and a variety of bat species already recorded along the river.',
    'The Witney Woodland Trust has completed its biggest planting season yet, with over 2,000 native trees now established along a two-mile stretch of the Windrush valley.',
    'https://witneygazette.co.uk/windrush-trees',
    'published',
    'environment',
    8,
    datetime('now', '-1 day'),
    datetime('now', '-1 day'),
    datetime('now', '-1 day')
  ),
  (
    'story_004',
    'submission',
    'patch_west_ox',
    NULL,
    'Chipping Norton literary festival returns with record lineup',
    'The annual Chipping Norton Literary Festival has announced its largest programme to date, featuring over 60 authors across four days of talks, workshops, and readings. This year the festival expands into the town hall and two additional venues to accommodate growing demand. Highlights include an evening with local poet Sarah Hargreaves and a children is writing workshop led by bestselling author Tom Palmer. Organisers say ticket sales are already ahead of last year and expect the event to bring significant footfall to local shops and restaurants.',
    'The annual Chipping Norton Literary Festival has announced its largest programme to date, featuring over 60 authors across four days of talks, workshops, and readings.',
    NULL,
    'published',
    'event',
    7,
    datetime('now', '-3 days'),
    datetime('now', '-3 days'),
    datetime('now', '-3 days')
  );
