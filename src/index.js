import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Koa from "koa";
import Router from "@koa/router";
import serve from "koa-static";
import { koaBody } from "koa-body";
import { parse, stringify } from "csv";
import JSZip from "jszip";
import { DateTime, Duration } from "luxon";

const app = new Koa();

const router = new Router();
const WEEK = Duration.fromObject({ days: 7 });

router.post(
  "/actions/schedule",
  koaBody({ multipart: true, json: false }),
  async (ctx, next) => {
    const { start, end } = ctx.request.body;

    const startDate = DateTime.fromISO(start);
    const endDate = DateTime.fromISO(end);

    const buffer = await readFile(ctx.request.files.file.filepath);
    const parser = parse(buffer, { encoding: "utf8", columns: true });

    const zip = new JSZip();

    for await (const { League, Time, Duration, Location, Address } of parser) {
      if (!League || !Time || !Duration || !Location || !Address) {
        console.log("Skipping invalid row");
        continue;
      }

      const weekday = {
        mon: 1,
        tue: 2,
        wed: 3,
        thu: 4,
        fri: 5,
        sat: 6,
        sun: 7,
      }[League.split(" ")[0].toLowerCase()];

      const data = [];
      for (
        let date = startDate.set({ weekday });
        date < endDate;
        date = date.plus(WEEK)
      ) {
        if (date < startDate) continue;
        data.push({
          Type: "GAME",
          "Game Type": "REGULAR",
          Title: League,
          Home: League,
          Away: League,
          Date: date.toFormat("dd/MM/yyyy"),
          Time,
          Duration,
          Location,
          Address,
          Notes: "",
        });
      }

      const output = stringify(data, {
        header: true,
        columns: [
          { key: "Type" },
          { key: "Game Type" },
          { key: "Title" },
          { key: "Home" },
          { key: "Away" },
          { key: "Date" },
          { key: "Time" },
          { key: "Duration" },
          { key: "Location" },
          { key: "Address" },
          { key: "Notes" },
        ],
      });

      zip.file(`${League}.csv`, output);
    }
    ctx.status = 200;
    ctx.body = zip.generateNodeStream();
    ctx.set("Content-Disposition", 'attachment; filename="schedule.zip"');
  }
);

const here = fileURLToPath(new URL(".", import.meta.url));
app.use(serve(join(here, "../public/"), { index: "index.html" }));
app.use(router.allowedMethods());
app.use(router.middleware());

const PORT = process.env.PORT ?? 8000;
app.listen(+PORT, () => {
  console.log(`Scheduler on ${PORT}`);
});
