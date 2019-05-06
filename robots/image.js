const imageDownloader = require('image-downloader');
const google = require('googleapis').google;
const customSearch = google.customsearch('v1');
const state = require('./state.js');

const googleSearchCredentials = require('./../credentials/google-search.json');

async function robot() {
  console.log(`> [image-robot] Starting...`);
  const content = state.load();

  await fetchImagesOfAllSentences(content);
  await downloadAllImages(content);
  

  async function fetchImagesOfAllSentences(content) {
    for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
      let query;

      if(sentenceIndex === 0){
        query = `${content.searchTerm}`;
      } else {
        query = `${content.searchTerm} ${content.sentences[sentenceIndex].keywords[0]}`;
      }
      
      console.log(`> [image-robot] Querying Google Images with "${query}"`);
      
      content.sentences[sentenceIndex].images = await fetchGoogleAndReturnUmagesLinks(query);

      content.sentence[sentenceIndex].googleSearchQuery = query;
    }
  }

  async function fetchGoogleAndReturnUmagesLinks(query) {
    const response = await customSearch.cse.list({
      auth: googleSearchCredentials.apiKey,
      cx: googleSearchCredentials.searchEngineId,
      q: query,
      searchType: 'image',
      num: 2
    });

    const imagesUrl = response.data.items.map(item => {
      return item.link;
    });

    return imagesUrl;
  }

  async function downloadAllImages(content) {
    content.downloaderImages = [];

    for (
      let sentenceIndex = 0;
      sentenceIndex < content.sentences.length;
      sentenceIndex++
    ) {
      const images = content.sentences[sentenceIndex].images;

      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        const imageUrl = images[imageIndex];

        try {
          if (content.downloaderImages.includes(imageUrl)) {
            throw new Error('Image already downloaded');
          }

          await downloadAndSave(imageUrl, `${sentenceIndex}-original.png`);
          content.downloaderImages.push(imageUrl);
          console.log(
            `> [image-robot] [${sentenceIndex}][${imageIndex}] Image succesfully downloaded: ${imageUrl}`
          );
          break;
        } catch (error) {
          console.log(
            `> [image-robot] [${sentenceIndex}][${imageIndex}] Error (${imageUrl}): ${error}`
          );
        }
      }
    }
  }

  async function downloadAndSave(url, fileName) {
    return imageDownloader.image({
      url: url,
      dest: `./content/${fileName}`
    });
  }
}

module.exports = robot;
