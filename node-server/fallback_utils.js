
// --- Fallback Question Generator (No AI) ---
function createFallbackQuestions(topic, wikiData, count = 5) {
  const fallbackQuestions = [];
  const content = wikiData ? wikiData.content : "";
  const title = wikiData ? wikiData.title : topic;
  const url = wikiData ? wikiData.url : "https://ja.wikipedia.org/wiki/" + encodeURIComponent(topic);

  // 1. Title Question
  fallbackQuestions.push({
    question: `このクイズのトピックは何ですか？（ヒント: ${content.substring(0, 20)}...）`,
    options: [title, "不明", "その他", "秘密"],
    correct_index: 0,
    explanation: `このクイズのトピックは「${title}」です。 (出典: ${url})`,
    citation: url
  });

  // 2. Length Question (Silly but works)
  fallbackQuestions.push({
    question: `「${title}」のWikipedia記事の文字数はどれくらい？`,
    options: ["10文字以下", "100文字以下", `${content.length}文字くらい`, "1億文字以上"],
    correct_index: 2,
    explanation: `実際の記事の文字数は約${content.length}文字です。 (出典: ${url})`,
    citation: url
  });
  
  // 3. First Character Question
  const firstChar = title.charAt(0);
  fallbackQuestions.push({
      question: `「${title}」の最初の文字は？`,
      options: [firstChar, "あ", "ん", "Z"],
      correct_index: 0,
      explanation: `「${title}」は「${firstChar}」で始まります。 (出典: ${url})`,
      citation: url
  });

   // 4. Topic Contains Question
   const containsKatakana = /[ァ-ン]/.test(title);
   fallbackQuestions.push({
       question: `「${title}」という言葉にカタカナは含まれていますか？`,
       options: [containsKatakana ? "はい" : "いいえ", containsKatakana ? "いいえ" : "はい", "分からない", "どちらでもない"],
       correct_index: 0,
       explanation: `「${title}」にはカタカナが${containsKatakana ? "含まれています" : "含まれていません"}。 (出典: ${url})`,
       citation: url
   });

   // 5. Random Fact (Mock)
   fallbackQuestions.push({
       question: `「${title}」について、もっと詳しく知りたいですか？`,
       options: ["はい、知りたい", "いいえ", "まあまあ", "どちらでもない"],
       correct_index: 0,
       explanation: `Wikipediaで「${title}」を検索して、さらに知識を深めましょう！ (出典: ${url})`,
       citation: url
   });

  return fallbackQuestions.slice(0, count).map(q => shuffleOptions(q));
}
