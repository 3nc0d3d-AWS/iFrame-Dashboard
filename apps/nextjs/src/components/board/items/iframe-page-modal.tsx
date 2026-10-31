"use client";

import { useState } from "react";
import { Checkbox, Stack, TextInput } from "@mantine/core";

import { createModal, modalSizeForm, ModalFormFooter, useModalAction } from "@homarr/modals";
import { useI18n } from "@homarr/translation/client";

export interface IframePageSubmitValues {
  title: string;
  embedUrl: string;
  proxyLogin: boolean;
}

const FORM_ID = "add-iframe-page-form";

export const IframePageModal = createModal<{
  onSubmit: (values: IframePageSubmitValues) => void;
}>(({ actions, innerProps }) => {
  const t = useI18n();
  const [title, setTitle] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [proxyLogin, setProxyLogin] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle === "") {
      setTitleError(t("board.iframePage.titleRequired"));
      return;
    }
    innerProps.onSubmit({ title: trimmedTitle, embedUrl: embedUrl.trim(), proxyLogin });
    actions.closeModal();
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit}>
      <Stack>
        <TextInput
          label={t("board.iframePage.titleLabel")}
          placeholder={t("board.iframePage.titlePlaceholder")}
          required
          withAsterisk
          data-autofocus
          value={title}
          error={titleError}
          onChange={(event) => {
            setTitle(event.currentTarget.value);
            if (titleError) setTitleError(null);
          }}
        />
        <TextInput
          label={t("board.iframePage.urlLabel")}
          description={t("board.iframePage.urlDescription")}
          placeholder="https://example.com"
          type="url"
          value={embedUrl}
          onChange={(event) => setEmbedUrl(event.currentTarget.value)}
        />
        <Checkbox
          label={t("board.iframePage.proxyLoginLabel")}
          description={t("board.iframePage.proxyLoginDescription")}
          checked={proxyLogin}
          onChange={(event) => setProxyLogin(event.currentTarget.checked)}
        />
        <ModalFormFooter
          form={FORM_ID}
          onCancel={actions.closeModal}
          submitLabel={t("board.iframePage.submit")}
        />
      </Stack>
    </form>
  );
}).withOptions({
  defaultTitle: (t) => t("board.iframePage.modalTitle"),
  size: modalSizeForm,
});

export const useIframePageModal = () => useModalAction(IframePageModal);
