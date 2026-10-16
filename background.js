// Кнопка расширения открывает боковую панель вместо небольшого popup-окна.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
  console.error("Не удалось настроить боковую панель:", error);
});
