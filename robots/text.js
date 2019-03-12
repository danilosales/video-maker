const algorithmia = require('algorithmia');
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey;
const setenceBoundaryDetection = require('sbd');

async function robot(content) {
    await fetchContentFromWikipedia(content);
    sanitizeContent(content);
    breakContentIntoSequences(content);

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
}

module.exports = robot;