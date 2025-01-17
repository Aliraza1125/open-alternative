import { endOfDay, startOfDay, subDays } from "date-fns"
import { generateLaunchPost } from "~/lib/generate-content"
import { sendBlueskyPost } from "~/services/bluesky"
import { inngest } from "~/services/inngest"
import { prisma } from "~/services/prisma"
import { sendTwitterPost } from "~/services/twitter"

export const postOnSocials = inngest.createFunction(
  { id: "post-on-socials" },
  { cron: "TZ=Europe/Warsaw 0 14 * * *" },

  async ({ step, logger }) => {
    const tools = await step.run("fetch-tools", async () => {
      return prisma.tool.findMany({
        where: {
          publishedAt: {
            gte: startOfDay(subDays(new Date(), 1)),
            lte: endOfDay(new Date()),
          },
        },
      })
    })

    if (tools.length) {
      const promises = tools.map(async tool =>
        step.run(`post-on-socials-${tool.name}`, async () => {
          logger.info(`Generating post about ${tool.name}`)
          const { post } = await generateLaunchPost(tool)

          logger.info(`Sending social post about ${tool.name}`, { post })

          return Promise.all([sendTwitterPost(post), sendBlueskyPost(post)])
        }),
      )

      await Promise.all(promises)
    }

    // Disconnect from DB
    await step.run("disconnect-from-db", async () => {
      return prisma.$disconnect()
    })
  },
)
