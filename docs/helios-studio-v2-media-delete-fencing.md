# Packet 68: Media reference deletion fencing

DELETE previously checked ownership before a separate deleteMany write. It now locks current editor/session authority, the owned project and selected media inside a transaction before resolving current metadata and deleting the reference. Access changes return 403 and unavailable projects/media return 404. The existing guarded deletion count and cleanup-pending response remain.

Provider objects and WorkspaceAsset registrations are retained. Deleting a Media reference is not proof of exclusive ownership of an R2 key or Stream UID, and this packet does not add storage deletion or new asset lifecycle policy. Existing foreign-key SetNull/Cascade behavior clears project presentation pointers and the collection hero atomically with the reference deletion.

Both-company HTTP/PostgreSQL qualification rejects foreign project/media deletion, observes six blocked access/session races, and injects an AFTER DELETE failure to prove full media/project/hero rollback. Concurrent deletes produce one success and one missing response; repeated deletion remains bounded. Successful image deletion clears hero, thumbnail, social-image and collection pointers. Image and Stream deletions retain all registry rows and report pending storage cleanup; foreign company records remain unchanged.

The tests only mutate disposable synthetic data. No provider request, real object deletion, schema migration, credentials or production action occurs. Trigger/function cleanup and unchanged schema/index/access postflight remain required. Hosted delivery, asset retirement/deletion policy and Helios compatibility remain separate Phase 1/2 work. Production ON HOLD.
