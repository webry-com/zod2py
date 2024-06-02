import { z } from "zod"
import { UserSchema } from "./user.js"

export default z.object({
  name: z.string(),
  members: z.array(z.string()),
  description: z.literal("asd"),
  user: UserSchema,
})
