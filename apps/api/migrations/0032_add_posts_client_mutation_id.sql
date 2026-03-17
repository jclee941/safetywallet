ALTER TABLE `posts` ADD `client_mutation_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `posts_client_mutation_id_idx` ON `posts` (`client_mutation_id`);
