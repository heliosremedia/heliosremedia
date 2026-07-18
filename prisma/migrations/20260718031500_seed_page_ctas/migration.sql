INSERT INTO "CallToAction" ("id", "internalName", "eyebrow", "headline", "body", "primaryLabel", "primaryActionType", "secondaryLabel", "secondaryActionType", "secondaryValue", "published", "updatedAt") VALUES
('cta_about_footer', 'About footer', 'Fort Collins · Northern Colorado', 'Ready to shape the first impression?', 'Tell us about the property, the audience, and what the campaign needs to accomplish. We''ll help build the right media plan.', 'Book Your Shoot', 'BOOKING', 'Explore the work', 'INTERNAL', '/portfolio', true, CURRENT_TIMESTAMP),
('cta_services_footer', 'Services footer', 'Build the right campaign', 'Let''s make the property impossible to overlook.', NULL, 'Book Your Shoot', 'BOOKING', 'View the portfolio', 'INTERNAL', '/portfolio', true, CURRENT_TIMESTAMP),
('cta_faq_footer', 'FAQ footer', 'Still curious?', 'Let''s talk through your project.', 'Tell us what you''re planning and we''ll help identify the right media package.', 'Book Your Shoot', 'BOOKING', 'Explore services', 'INTERNAL', '/services', true, CURRENT_TIMESTAMP),
('cta_portfolio_footer', 'Portfolio footer', 'Your property, intentionally presented', 'Ready to create the next story?', 'Build a tailored media campaign designed around the property, the audience, and the result you need.', 'Book Your Shoot', 'BOOKING', 'Explore services', 'INTERNAL', '/services', true, CURRENT_TIMESTAMP);

INSERT INTO "CtaPlacement" ("id", "slot", "ctaId", "updatedAt") VALUES
('cta_placement_about_footer', 'ABOUT_FOOTER', 'cta_about_footer', CURRENT_TIMESTAMP),
('cta_placement_services_footer', 'SERVICES_FOOTER', 'cta_services_footer', CURRENT_TIMESTAMP),
('cta_placement_faq_footer', 'FAQ_FOOTER', 'cta_faq_footer', CURRENT_TIMESTAMP),
('cta_placement_portfolio_footer', 'PORTFOLIO_FOOTER', 'cta_portfolio_footer', CURRENT_TIMESTAMP);
