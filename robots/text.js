const algorithmia = require('algorithmia');
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey;
const setenceBoundaryDetection = require('sbd');

const watsonApiKey = require('../credentials/watson-nlu.json').apikey;
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');
 
const nlu = new NaturalLanguageUnderstandingV1({
  iam_apikey: watsonApiKey,
  version: '2018-04-05',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
});

const state = require('./state.js');

async function robot() {
    const content = state.load();

    await fetchContentFromWikipedia(content);
    sanitizeContent(content);
    breakContentIntoSequences(content);
    limitMaximumSetences(content);
    await fetchKeywordsOfAllSentences(content);

    state.save(content);

    async function fetchContentFromWikipedia(content) {
        const algorithmiaAuthenticated = algorithmia(algorithmiaApiKey);
        const wikipediaAlgorithmia = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2');
        const wikipediaResponse = await wikipediaAlgorithmia.pipe(content.searchTerm);
        const wikipediaContent = wikipediaResponse.get();
        
        content.sourceContentOriginal = wikipediaContent.content;
        
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
        content.setences = [];

        const setences = setenceBoundaryDetection.sentences(content.sourceContentSanitized);
        setences.forEach((setence) => {
            content.setences.push({
                text: setence,
                keywords: [],
                images: []
            });
        })
    }

    async function fetchKeywordsOfAllSentences(content) {
        for(const setence of content.setences) {
            setence.keywords = await fetchWatsonAndReturnKeywords(setence.text);
        }
    }

    function limitMaximumSetences(content) {
        content.setences = content.setences.slice(0, content.maximumSetences);
    }

    async function fetchWatsonAndReturnKeywords(setence) {
        return new Promise((resolve, reject) => {
            nlu.analyze({
                text: setence,
                features: {
                    keywords: {}
                }
            }, (error, response) => {
                if(error) {
                    reject(error);
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