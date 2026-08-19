const { discoverCatalogue } = require('./discoverCatalogue');

async function main() {
  const { cataloguePages, bookUrls, uniqueBookUrls } = await discoverCatalogue();
  console.log(
    `catalogue_pages=${cataloguePages.length} discovered=${bookUrls.length} unique_urls=${uniqueBookUrls.length}`
  );
}

main();
