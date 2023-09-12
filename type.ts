void (async () => {
  const { mkdir, readFile, writeFile } = await import("fs/promises");

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const packageJson = JSON.parse(await readFile("./package.json", "utf-8"));
  const type = process.argv[2];

  if (!["module", "commonjs"].includes(type)) {
    throw new Error(`Invalid type: ${type}`);
  }

  await writeFile(
    "./package.json",
    JSON.stringify({ ...packageJson, type }, null, 2),
  );

  const dir = type === "module" ? "esm" : "cjs";

  await mkdir(`./dist/${dir}`, { recursive: true });
  await writeFile(
    `./dist/${dir}/package.json`,
    JSON.stringify({ type }, null, 2),
  );
})();
