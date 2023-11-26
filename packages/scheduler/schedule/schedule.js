import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "csv";
import JSZip from "jszip";
import { DateTime, Duration } from "luxon";

const WEEK = Duration.fromObject({ days: 7 });

export async function main({ start, end, file }) {
  const startDate = DateTime.fromISO(start);
  const endDate = DateTime.fromISO(end);
  const parser = parse(file, { encoding: "utf8", columns: true });

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
        Away: "",
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
  return {
    headers: { "Content-Type": "application/zip" },
    body: await zip.generateAsync(),
  };
}
