const algorithmia = require('algorithmia');
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey;
const sentenceBoundaryDetection = require('sbd');

const watsonApiKey = require('../credentials/watson-nlu.json').apikey;
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');
 
const nlu = new NaturalLanguageUnderstandingV1({
  iam_apikey: watsonApiKey,
  version: '2018-04-05',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
});

const state = require('./state.js');

async function robot() {
    console.log('> [text-robot] Starting....');
    const content = state.load();

    await fetchContentFromWikipedia(content);
    sanitizeContent(content);
    breakContentIntoSequences(content);
    limitMaximumSentences(content);
    await fetchKeywordsOfAllSentences(content);

    state.save(content);

    async function fetchContentFromWikipedia(content) {
        console.log('> [text-robot] Fetching content from wikipedia.');
        const algorithmiaAuthenticated = algorithmia(algorithmiaApiKey);
        const wikipediaAlgorithmia = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2');
        const wikipediaResponse = await wikipediaAlgorithmia.pipe(content.searchTerm);
        const wikipediaContent = wikipediaResponse.get();
        
        content.sourceContentOriginal = wikipediaContent.content;
        console.log('> [text-robot] Fetching done.');
    }

    function sanitizeContent(content) {
        const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal);
        const withoutDatesInParethenses = removeDatesInParentheses(withoutBlankLinesAndMarkdown);
        
        content.sourceContentSanitized = withoutDatesInParethenses;

        function removeBlankLinesAndMarkdown(text) {
            const allLines = text.split('\n');

            const withoutBlankLinesAndMarkdown = allLines.filter((line) => {
                if(line.trim().length === 0 || line.trim().startsWith('=')) {
                    return false;
                }

                return true;
            });

            return withoutBlankLinesAndMarkdown.join(' ');
        }

        function removeDatesInParentheses(text) {
            return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g,' ')
        }
    }

    function breakContentIntoSequences(content) {
        content.sentences = [];

        const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized);
        sentences.forEach((sentence) => {
            content.sentences.push({
                text: sentence,
                keywords: [],
                images: []
            });
        })
    }

    async function fetchKeywordsOfAllSentences(content) {
        console.log('> [text-robot] Starting to fetch keywords from Watson');
        for(const sentence of content.sentences) {
            console.log(`> [text-robot] Setence: "${sentence.text}"`);
            sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text);
            
            console.log(`> [text-robot] Keywords: ${sentence.keywords.join(', ')}`);
        }
    }

    function limitMaximumSentences(content) {
        content.sentences = content.sentences.slice(0, content.maximumSentences);
    }

    async function fetchWatsonAndReturnKeywords(sentence) {
        return new Promise((resolve, reject) => {
            nlu.analyze({
                text: sentence,
                features: {
                    keywords: {}
                }
            }, (error, response) => {
                if(error) {
                    reject(error);
                    return;
                }
                const keywords = response.keywords.map((keyword) => {
                    return keyword.text;
                });
                resolve(keywords);
            })
        });
    }
}

module.exports = robot;