INSERT INTO "Service" (
  "id",
  "name",
  "slug",
  "description",
  "displayOrder",
  "active",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'svc_photography',
    'Photography',
    'photography',
    'Professional interior, exterior, and architectural photography.',
    0,
    true,
    NOW(),
    NOW()
  ),
  (
    'svc_drone_photography',
    'Drone Photography',
    'drone-photography',
    'Aerial perspectives that reveal setting, scale, and location.',
    1,
    true,
    NOW(),
    NOW()
  ),
  (
    'svc_cinematic_films',
    'Cinematic Films',
    'cinematic-films',
    'Story-driven property films created for premium presentation.',
    2,
    true,
    NOW(),
    NOW()
  ),
  (
    'svc_vertical_reels',
    'Vertical Reels',
    'vertical-reels',
    'Short-form vertical video designed for social-first distribution.',
    3,
    true,
    NOW(),
    NOW()
  ),
  (
    'svc_agent_branding',
    'Agent Branding',
    'agent-branding',
    'Personal brand media that helps agents build recognition and trust.',
    4,
    true,
    NOW(),
    NOW()
  ),
  (
    'svc_social_content',
    'Social Content',
    'social-content',
    'Platform-ready content for consistent, high-quality social marketing.',
    5,
    true,
    NOW(),
    NOW()
  ),
  (
    'svc_floor_plans',
    'Floor Plans',
    'floor-plans',
    'Clear property layouts that help buyers understand space and flow.',
    6,
    true,
    NOW(),
    NOW()
  ),
  (
    'svc_matterport',
    'Matterport',
    'matterport',
    'Immersive three-dimensional tours for remote and repeat viewing.',
    7,
    true,
    NOW(),
    NOW()
  ),
  (
    'svc_property_websites',
    'Property Websites',
    'property-websites',
    'Dedicated digital destinations that bring every listing asset together.',
    8,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT ("slug") DO NOTHING;
