import { uploadImageHandler } from "./upload-image-handler";
import { deleteImageHandler } from "./delete-image-handler";
import type { ActionsImageRouteApp } from "./helpers";

export const registerUploadRoutes = (app: ActionsImageRouteApp): void => {
  app.post("/:id/images", uploadImageHandler);
  app.delete("/:id/images/:imageId", deleteImageHandler);
};
