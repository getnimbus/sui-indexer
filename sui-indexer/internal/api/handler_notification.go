package api

import (
	"net/http"

	"github.com/getnimbus/ultrago/u_handler"
	"github.com/go-chi/chi/v5"
)

func NewHealthcheckHandler(
	baseHandler *u_handler.BaseHandler,
) *HealthcheckHandler {
	return &HealthcheckHandler{
		BaseHandler: baseHandler,
	}
}

type HealthcheckHandler struct {
	*u_handler.BaseHandler
}

func (h *HealthcheckHandler) Route() chi.Router {
	mux := chi.NewRouter()
	mux.Get("/", h.handlerHealthcheck)
	mux.Post("/", h.handlerHealthcheck)
	return mux
}

func (h *HealthcheckHandler) handlerHealthcheck(w http.ResponseWriter, r *http.Request) {
	h.Success(w, r, map[string]interface{}{
		"status": "ok",
	})
}
